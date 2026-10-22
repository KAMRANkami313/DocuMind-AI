'use client';

import * as React from 'react';
import { Send } from 'lucide-react';
import { useChat } from '@/hooks/use-chat';
import { StopButton } from '@/components/chat/stop-button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  formRef?: React.RefObject<HTMLFormElement | null>;
}

export function ChatInput({ formRef }: ChatInputProps) {
  const {
    input,
    setInput,
    isLoading,
    activeDoc,
    handleSubmit,
    isStreaming,
    stopGeneration,
  } = useChat();

  const inputRef = React.useRef<HTMLInputElement>(null);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void handleSubmit();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!isLoading && input.trim() && activeDoc) {
        void handleSubmit();
      }
    }
  }

  return (
    <div className="border-t border-border bg-surface/60 p-3 sm:p-4 backdrop-blur-md">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="mx-auto flex max-w-3xl gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            activeDoc
              ? `Ask anything about ${activeDoc.name}...`
              : 'Upload a PDF to start asking questions...'
          }
          disabled={isLoading || !activeDoc}
          className={cn(
            'flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg',
            'placeholder-fg-subtle transition focus:border-primary focus:outline-none disabled:opacity-50',
          )}
        />
        {isStreaming ? (
          <StopButton onClick={stopGeneration} />
        ) : (
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !activeDoc}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition',
              'bg-primary text-primary-fg hover:bg-primary-hover',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'shadow-md shadow-primary/25',
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
      <p className="mx-auto mt-1.5 hidden max-w-3xl text-[10px] text-fg-subtle sm:block">
        Press{' '}
        <kbd className="rounded border border-border bg-surface-2 px-1 py-0.5 font-mono text-fg-muted">
          ⌘ + Enter
        </kbd>{' '}
        to send
      </p>
    </div>
  );
}
