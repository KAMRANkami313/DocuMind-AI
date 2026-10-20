'use client';

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

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void handleSubmit();
  }

  return (
    <div className="border-t border-border bg-surface/60 p-3 sm:p-4 backdrop-blur-md">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="mx-auto flex max-w-3xl gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
              'flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition',
              'bg-linear-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'shadow-md shadow-primary/20',
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  );
}
