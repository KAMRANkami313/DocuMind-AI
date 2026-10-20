'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Sidebar } from './sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';


export function MobileSidebar() {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = React.useState(false);

  if (!isMobile) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed top-3 left-3 z-40 flex h-9 w-9 items-center justify-center rounded-lg',
          'border border-border bg-surface text-fg transition-colors hover:bg-surface-2 cursor-pointer',
          'shadow-sm',
        )}
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      <Sheet isOpen={isOpen} onClose={() => setIsOpen(false)} side="left">
        <Sidebar
          className="border-r-0 w-80"
          onNavigate={() => setIsOpen(false)}
        />
      </Sheet>
    </>
  );
}