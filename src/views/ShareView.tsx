import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import CreativeShareView from './CreativeShareView';
import ParametricShareView from './ParametricShareView';
import { Loader2 } from 'lucide-react';
import { ConversationContext } from '@/contexts/ConversationContext';
import { useState } from 'react';
import { Conversation, Message } from '@shared/types';
import { CurrentMessageContext } from '@/contexts/CurrentMessageContext';

export default function ShareView() {
  const { id: conversationId } = useParams();
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);

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
        .limit(1)
        .single()
        .overrideTypes<Conversation>();

      if (error) {
        throw error;
      }
      return data;
    },
  });

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
      value={{ currentMessage, setCurrentMessage }}
    >
      <ConversationContext.Provider value={{ conversation }}>
        {conversation.type === 'creative' ? (
          <CreativeShareView />
        ) : (
          <ParametricShareView />
        )}
      </ConversationContext.Provider>
    </CurrentMessageContext.Provider>
  );
}
