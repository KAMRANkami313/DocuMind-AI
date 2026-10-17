'use client';

import { Send } from 'lucide-react';
import { useChat } from '@/hooks/use-chat';

interface ChatInputProps {
  formRef?: React.RefObject<HTMLFormElement | null>;
}

export function ChatInput({ formRef }: ChatInputProps) {
  const { input, setInput, isLoading, activeDoc, handleSubmit } = useChat();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void handleSubmit();
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="mx-auto flex max-w-4xl gap-2"
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
          className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-500 transition focus:border-indigo-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim() || !activeDoc}
          className="flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}