'use client';

import React, { useEffect } from 'react';
import { X, BookOpen, Layers } from 'lucide-react';
import { Citation } from '@/types';

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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-zinc-900 border-l border-zinc-800 shadow-2xl p-6 z-10 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              Document Source Excerpt
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-zinc-800/80 hover:bg-zinc-700 transition"
              title="Close drawer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Layers className="w-3.5 h-3.5" />
                Page {citation.pageNumber}
              </span>
              <span className="text-xs text-zinc-400">
                Relevance: {Math.round(citation.similarity * 100)}%
              </span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-mono">
              {citation.excerpt}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition"
        >
          Close Preview
        </button>
      </div>
    </div>
  );
}