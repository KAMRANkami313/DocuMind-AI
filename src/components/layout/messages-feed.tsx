'use client';

import * as React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { MessageItem } from '@/components/chat/message-item';
import { EmptyState } from './empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useChat } from '@/hooks/use-chat';
import type { Citation } from '@/types';
import { cn } from '@/lib/utils';

export function MessagesFeed() {
  const {
    messages,
    activeSession,
    isLoading,
    isStreaming,
    // ⚠️ isSessionLoading is true while loadChatSession is fetching the
    // messages + attached docs for the active session (after user clicks
    // a chat in the sidebar). Distinguish from `isLoading` which is for
    // streaming chat replies.
    isSessionLoading,
    openCitation,
    deleteSpecificMessage,
    handleInPlaceEdit,
    handleSendSuggestion,
    handleRegenerate,
  } = useChat();
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeSession, isLoading]);

  // ⚠️ Show skeleton during chat-history load (clicking a chat in sidebar)
  // OR during chat-request streaming. Previously the skeleton only showed
  // during chat requests, leaving the message area blank for ~150ms while
  // history was loading — the user thought the chat was empty.
  const showHistorySkeleton =
    isSessionLoading && messages.length === 0 && !isLoading;
  const showStreamingSkeleton =
    isLoading && messages.length === 0 && !isSessionLoading;
  const showSkeleton = showHistorySkeleton || showStreamingSkeleton;
  const showEmptyState =
    (!activeSession || messages.length === 0) && !isLoading && !isSessionLoading;

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
      {showSkeleton ? (
        <div className="space-y-6">
          {/* Header line: shows whether we're loading history or streaming */}
          <div className="flex items-center gap-2 text-xs text-fg-subtle">
            {showHistorySkeleton ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Loading chat history…</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Generating response…</span>
              </>
            )}
          </div>
          {/* Assistant message skeleton */}
          <div className="flex w-full max-w-2xl gap-2 sm:gap-3 flex-col items-start sm:flex-row sm:items-start">
            <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          {/* User message skeleton (right-aligned) */}
          <div className="ml-auto flex w-full max-w-2xl gap-2 sm:gap-3 flex-col items-end sm:flex-row sm:justify-end">
            <div className="flex-1 space-y-2 sm:order-1">
              <Skeleton className="ml-auto h-3 w-1/2" />
              <Skeleton className="ml-auto h-3 w-2/5" />
            </div>
            <Skeleton className="h-8 w-8 shrink-0 rounded-lg sm:order-2" />
          </div>
        </div>
      ) : showEmptyState ? (
        <EmptyState hasActiveSession={activeSession !== null} />
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
              onSelectSuggestion={handleSendSuggestion}
              onSaveEdit={(newText: string) => void handleInPlaceEdit(idx, newText)}
              onDeleteMessage={() => void deleteSpecificMessage(idx)}
              onRegenerate={isLastAssistant ? () => void handleRegenerate() : undefined}
              isLast={isLast}
            />
          );
        })
      )}
      <div ref={chatEndRef} className={cn(!showSkeleton && !showEmptyState && 'h-1')} />
    </div>
  );
}