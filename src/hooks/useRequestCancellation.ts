import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useRequestCancellation() {
  const cancelRequest = useCallback(async (messageId: string) => {
    const channelName = `cancel-request-${messageId}`;

    // Create a temporary channel to broadcast the cancellation
    const channel = supabase.channel(channelName);

    try {
      // Subscribe to the channel first
      channel.subscribe();

      // Broadcast the cancellation signal
      await channel.send({
        type: 'broadcast',
        event: 'cancel',
        payload: { messageId, timestamp: Date.now() },
      });

      console.log(`Sent cancellation signal for message ${messageId}`);
    } catch (error) {
      console.error('Failed to send cancellation signal:', error);
    } finally {
      // Clean up the channel
      supabase.removeChannel(channel);
    }
  }, []);

  return { cancelRequest };
}
