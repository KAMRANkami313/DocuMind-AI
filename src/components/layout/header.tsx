'use client';

import { Eye, RotateCcw } from 'lucide-react';
import { useChat } from '@/hooks/use-chat';

interface HeaderProps {
  onOpenPreview: () => void;
}

export function Header({ onOpenPreview }: HeaderProps) {
  const { activeDoc, clearActiveChat } = useChat();

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-800/80 bg-zinc-900/20 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-500">Active Document:</span>
        <span className="rounded-md border border-zinc-700/50 bg-zinc-800/80 px-2.5 py-1 font-medium text-zinc-200">
          {activeDoc ? activeDoc.name : 'None selected'}
        </span>
      </div>

      {activeDoc && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPreview}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          >
            <Eye className="h-3.5 w-3.5 text-indigo-400" />
            View Document
          </button>
          <button
            type="button"
            onClick={() => void clearActiveChat()}
            title="Clear current chat"
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-red-300"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear Chat
          </button>
        </div>
      )}
    </header>
  );
}