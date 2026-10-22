'use client';

import * as React from 'react';
import { MessageItem } from '@/components/chat/message-item';
import { EmptyState } from './empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useChat } from '@/hooks/use-chat';
import type { Citation, ChatMessage } from '@/types';

interface MessagesFeedProps {
  onSelectSuggestion?: (question: string) => void;
}

function LoadingSkeleton() {
  return (
    <div className="flex w-full max-w-2xl gap-3">
      <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
}

export function MessagesFeed({ onSelectSuggestion }: MessagesFeedProps) {
  const {
    currentMessages,
    activeDoc,
    isLoading,
    isStreaming,
    openCitation,
    deleteSpecificMessage,
    handleInPlaceEdit,
    handleSendSuggestion,
    handleRegenerate,
  } = useChat();

  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, activeDoc, isLoading]);

  const messages = currentMessages as ChatMessage[];
  const showEmptyState = messages.length === 1 && messages[0]?.role === 'assistant' && !isLoading;
  const hasActiveDoc = activeDoc !== null;
  const handleSuggestion = onSelectSuggestion ?? handleSendSuggestion;
  const showLoadingSkeleton = isLoading && messages.length <= 1;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      {/* Centered container keeping messages & skeletons neat */}
      <div className="mx-auto max-w-4xl space-y-6">
        {showLoadingSkeleton ? (
          <LoadingSkeleton />
        ) : showEmptyState ? (
          <EmptyState hasActiveDoc={hasActiveDoc} />
        ) : (
          messages.map((msg, idx) => {
            const isLast = idx === messages.length - 1;
            const isLastAssistant = isLast && msg.role === 'assistant';
            return (
              <MessageItem
                key={msg.id ?? idx}
                role={msg.role as 'user' | 'assistant'}
                content={msg.content}
                citations={msg.citations}
                isStreaming={isLastAssistant && isStreaming}
                onSelectCitation={(cite: Citation) => openCitation(cite)}
                onSelectSuggestion={handleSuggestion}
                onSaveEdit={(newText: string) =>
                  void handleInPlaceEdit(idx, newText)
                }
                onDeleteMessage={() => void deleteSpecificMessage(idx)}
                onRegenerate={isLastAssistant ? () => void handleRegenerate() : undefined}
                isLast={isLast}
              />
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}