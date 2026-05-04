import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { CreativeEditorView } from './CreativeEditorView';
import { ParametricEditorView } from './ParametricEditorView';
import { ConversationContext } from '@/contexts/ConversationContext';
import { Conversation, Message } from '@shared/types';
import { MessageItem } from '../types/misc.ts';
import { useEffect, useState } from 'react';
import { CurrentMessageContext } from '@/contexts/CurrentMessageContext';
import { SelectedItemsContext } from '@/contexts/SelectedItemsContext';

export default function EditorView() {
  const { id: conversationId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [images, setImages] = useState<MessageItem[]>([]);
  const [mesh, setMesh] = useState<MessageItem | null>(null);
  const navigate = useNavigate();

  const { data: conversation, isLoading: isConversationLoading } = useQuery({
    queryKey: ['conversation', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user?.id ?? '')
        .limit(1)
        .single();

      if (error) {
        throw error;
      }

      return data as Conversation;
    },
  });

  const { mutate: updateConversation, mutateAsync: updateConversationAsync } =
    useMutation({
      mutationFn: async (conversation: Conversation) => {
        const { data, error } = await supabase
          .from('conversations')
          .update(conversation)
          .eq('id', conversation.id)
          .select()
          .single()
          .overrideTypes<Conversation>();

        if (error) {
          throw error;
        }

        return data;
      },
      onMutate(conversation) {
        const oldConversation = queryClient.getQueryData<Conversation>([
          'conversation',
          conversation.id,
        ]);
        queryClient.setQueryData(
          ['conversation', conversation.id],
          conversation,
        );
        return { oldConversation };
      },
      onSuccess() {
        queryClient.invalidateQueries({
          queryKey: ['conversation', conversationId],
        });
        queryClient.invalidateQueries({
          queryKey: ['conversations'],
        });
      },
      onError(_error, conversation, context) {
        queryClient.setQueryData(
          ['conversation', conversation.id],
          context?.oldConversation,
        );
      },
    });

  useEffect(() => {
    if (!conversationId) {
      navigate('/');
    }
  }, [conversationId, navigate]);

  if (isConversationLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-adam-bg-secondary-dark text-adam-text-primary">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-adam-bg-secondary-dark text-adam-text-primary">
        <span className="text-2xl font-medium">404</span>
        <span className="text-sm">Conversation not found</span>
      </div>
    );
  }

  return (
    <CurrentMessageContext.Provider
      value={{
        currentMessage,
        setCurrentMessage,
      }}
    >
      <ConversationContext.Provider
        value={{
          conversation,
          updateConversation,
          updateConversationAsync,
        }}
      >
        <SelectedItemsContext.Provider
          value={{ images, setImages, mesh, setMesh }}
        >
          {conversation.type === 'creative' ? (
            <CreativeEditorView />
          ) : (
            <ParametricEditorView />
          )}
        </SelectedItemsContext.Provider>
      </ConversationContext.Provider>
    </CurrentMessageContext.Provider>
  );
}
