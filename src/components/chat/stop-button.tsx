'use client';

import { Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StopButtonProps {
  onClick: () => void;
  className?: string;
}

export function StopButton({ onClick, className }: StopButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3',
        'text-sm font-medium text-fg transition-colors hover:bg-surface-2 cursor-pointer',
        className,
      )}
      aria-label="Stop generating"
      title="Stop generating"
    >
      <Square className="h-3.5 w-3.5 fill-current" />
      <span>Stop</span>
    </button>
  );
}