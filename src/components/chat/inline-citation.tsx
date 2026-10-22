'use client';

import { BookText } from 'lucide-react';
import type { Citation } from '@/types';
import { cn } from '@/lib/utils';

interface InlineCitationProps {
  citation: Citation;
  onClick: (citation: Citation) => void;
  className?: string;
}

export function InlineCitation({ citation, onClick, className }: InlineCitationProps) {
  const relevance = Math.round(citation.similarity * 100);
  return (
    <button
      type="button"
      onClick={() => onClick(citation)}
className={cn(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
  'bg-citation-bg text-citation-fg border border-primary/30',
  'transition-all hover:opacity-80 hover:border-primary/50 hover:shadow-sm',
  'cursor-pointer',
  className,
)}
      title={`Page ${citation.pageNumber} • ${relevance}% match`}
    >
      <BookText className="h-3 w-3 shrink-0" />
      <span>p. {citation.pageNumber}</span>
      <span className="text-fg-subtle">({relevance}%)</span>
    </button>
  );
}