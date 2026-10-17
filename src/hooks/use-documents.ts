'use client';

import { useChatContext } from '@/providers/chat-provider';

export function useDocuments() {
  const {
    documents,
    activeDoc,
    switchDocument,
    addDocument,
    deleteDocument,
  } = useChatContext();
  return {
    documents,
    activeDoc,
    switchDocument,
    addDocument,
    deleteDocument,
  };
}