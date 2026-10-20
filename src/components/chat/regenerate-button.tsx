'use client';

import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';

interface RegenerateButtonProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

export function RegenerateButton({
  onClick,
  className,
  disabled,
}: RegenerateButtonProps) {
  return (
    <Tooltip content="Regenerate response" side="top">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md',
          'text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg',
          'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
          className,
        )}
        aria-label="Regenerate response"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  );
}