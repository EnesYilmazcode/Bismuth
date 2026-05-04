import { useConversation } from '@/contexts/ConversationContext';
import { supabase } from '@/lib/supabase';
import { Prompt } from '@shared/types';
import { useQueries, useQuery } from '@tanstack/react-query';

export function useImageData(id: string) {
  const { conversation } = useConversation();

  const dataQuery = useQuery({
    queryKey: ['imageData', conversation.user_id, conversation.id, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('images')
        .select('*')
        .eq('id', id)
        .single()
        .overrideTypes<{
          prompt: Prompt;
        }>();

      if (error) {
        throw error;
      }

      return data;
    },
    refetchInterval: (query) => {
      if (query.state.data?.status === 'pending') {
        return 10 * 1000;
      }
      return false;
    },
  });

  const urlQuery = useQuery({
    queryKey: ['image', conversation.user_id, conversation.id, id],
    enabled: dataQuery.data?.status === 'success',
    queryFn: async () => {
      const reader = new FileReader();
      const { data } = await supabase.storage
        .from('images')
        .download(`${conversation.user_id}/${conversation.id}/${id}`);
      if (!data) {
        throw new Error('Failed to download image');
      }
      const urlPromise = new Promise((resolve) => {
        reader.onload = () => {
          resolve(reader.result as string);
        };
      });
      reader.readAsDataURL(data);
      const url = (await urlPromise) as string;
      return { id, url };
    },
  });

  return { data: dataQuery, url: urlQuery };
}

export function useImagesData(ids: string[]) {
  const { conversation } = useConversation();

  const dataQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['imageData', conversation.user_id, conversation.id, id],
      enabled: !!id,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('images')
          .select('*')
          .eq('id', id)
          .single()
          .overrideTypes<{
            prompt: Prompt;
          }>();

        if (error) {
          throw error;
        }

        return data;
      },
    })),
  });

  const urlQueries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['image', conversation.user_id, conversation.id, id],
      enabled: dataQueries.some(
        (query) =>
          query.data && query.data.id === id && query.data.status === 'success',
      ),
      queryFn: async () => {
        const reader = new FileReader();
        const { data } = await supabase.storage
          .from('images')
          .download(`${conversation.user_id}/${conversation.id}/${id}`);
        if (!data) {
          throw new Error('Failed to download image');
        }
        const urlPromise = new Promise((resolve) => {
          reader.onload = () => {
            resolve(reader.result as string);
          };
        });
        reader.readAsDataURL(data);
        const url = (await urlPromise) as string;
        return { id, url };
      },
    })),
  });

  return { data: dataQueries, url: urlQueries };
}
