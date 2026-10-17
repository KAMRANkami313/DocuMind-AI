'use client';

import * as React from 'react';
import { MessageItem } from '@/components/chat/message-item';
import { EmptyState } from './empty-state';
import { useChat } from '@/hooks/use-chat';
import type { Citation, ChatMessage } from '@/types';

interface MessagesFeedProps {
  onSelectSuggestion?: (question: string) => void;
}

export function MessagesFeed({ onSelectSuggestion }: MessagesFeedProps) {
  const {
    currentMessages,
    activeDoc,
    isLoading,
    openCitation,
    deleteSpecificMessage,
    handleInPlaceEdit,
    handleSendSuggestion,
  } = useChat();

  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, activeDoc, isLoading]);

  const messages = currentMessages as ChatMessage[];
  const showEmptyState = messages.length === 1 && messages[0]?.role === 'assistant';
  const hasActiveDoc = activeDoc !== null;
  const handleSuggestion = onSelectSuggestion ?? handleSendSuggestion;

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      {showEmptyState ? (
        <EmptyState hasActiveDoc={hasActiveDoc} />
      ) : (
        messages.map((msg, idx) => (
          <MessageItem
            key={msg.id ?? idx}
            role={msg.role as 'user' | 'assistant'}
            content={msg.content}
            citations={msg.citations}
            onSelectCitation={(cite: Citation) => openCitation(cite)}
            onSelectSuggestion={handleSuggestion}
            onSaveEdit={(newText: string) =>
              void handleInPlaceEdit(idx, newText)
            }
            onDeleteMessage={() => void deleteSpecificMessage(idx)}
          />
        ))
      )}
      <div ref={chatEndRef} />
    </div>
  );
}