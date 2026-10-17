'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './theme-provider';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  return (
    <Tooltip
      content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      side="bottom"
    >
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg cursor-pointer',
          className,
        )}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>
    </Tooltip>
  );
}