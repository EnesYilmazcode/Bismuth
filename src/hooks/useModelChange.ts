import { useConversation } from '@/contexts/ConversationContext';
import { Model } from '@shared/types';

export function useModelChange() {
  const { conversation, updateConversation } = useConversation();

  const handleModelChange = (model: Model) => {
    if (!updateConversation) return;
    updateConversation({
      ...conversation,
      settings: {
        ...(typeof conversation.settings === 'object'
          ? conversation.settings
          : {}),
        model: model,
      },
    });
  };

  return handleModelChange;
}
