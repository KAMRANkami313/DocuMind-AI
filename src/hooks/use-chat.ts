'use client';

import { useChatContext } from '@/providers/chat-provider';

export function useChat() {
  return useChatContext();
}