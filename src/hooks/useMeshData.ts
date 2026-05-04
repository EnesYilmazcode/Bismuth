import { useConversation } from '@/contexts/ConversationContext';
import { supabase } from '@/lib/supabase';
import { MeshData } from '@shared/types';
import { useQuery } from '@tanstack/react-query';

export const useMeshData = ({ id }: { id: string }) => {
  const { conversation } = useConversation();

  const dataQuery = useQuery({
    queryKey: ['meshData', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meshes')
        .select('*')
        .eq('id', id)
        .limit(1)
        .single()
        .overrideTypes<MeshData>();

      if (error) {
        throw error;
      }

      return data;
    },
    // Poll while pending to ensure UI progresses past 95% as soon as status flips
    refetchInterval: (query) => {
      const current = query.state.data as MeshData | undefined;
      return current && current.status === 'pending' ? 3000 : false;
    },
  });

  const blobQuery = useQuery({
    queryKey: ['mesh', id],
    enabled:
      !!id &&
      !dataQuery.isLoading &&
      dataQuery.data &&
      dataQuery.data.status === 'success',
    queryFn: async () => {
      const fileExtension = dataQuery.data?.file_type || 'glb';
      const { data, error } = await supabase.storage
        .from('meshes')
        .download(
          `${conversation.user_id}/${conversation.id}/${id}.${fileExtension}`,
        );

      if (error) {
        throw error;
      }

      return data;
    },
    refetchOnMount: false,
  });

  return {
    data: dataQuery,
    blob: blobQuery,
  };
};
