'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Sidebar } from './sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function MobileSidebar() {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = React.useState(false);

  if (!isMobile) return null;

  return (
    <>
      <Tooltip content="Open menu" side="right">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={cn(
            'fixed top-3 left-3 z-40 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-fg transition-colors hover:bg-surface-2 cursor-pointer',
          )}
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>
      </Tooltip>

      <Sheet isOpen={isOpen} onClose={() => setIsOpen(false)} side="left">
        <Sidebar className="border-r-0 w-80" />
      </Sheet>
    </>
  );
}