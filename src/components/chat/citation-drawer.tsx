'use client';

import React, { useEffect } from 'react';
import { X, BookOpen, Layers } from 'lucide-react';
import { type Citation } from '@/types';

interface CitationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citation: Citation | null;
}

export function CitationDrawer({ isOpen, onClose, citation }: CitationDrawerProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !citation) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Clickable Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 cursor-pointer bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer */}
      <div className="animate-in slide-in-from-right relative z-10 flex w-full max-w-md flex-col justify-between overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-6 shadow-2xl duration-200">
        <div>
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <BookOpen className="h-4 w-4 text-indigo-400" />
              Document Source Excerpt
            </div>
            <button
              onClick={onClose}
              className="rounded-lg bg-zinc-800/80 p-1.5 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
              title="Close drawer (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300">
                <Layers className="h-3.5 w-3.5" />
                Page {citation.pageNumber}
              </span>
              <span className="text-xs text-zinc-400">
                Relevance: {Math.round(citation.similarity * 100)}%
              </span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-zinc-300">
              {citation.excerpt}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-zinc-800 py-2.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700"
        >
          Close Preview
        </button>
      </div>
    </div>
  );
}
