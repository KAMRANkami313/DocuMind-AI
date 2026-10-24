'use client';

import * as React from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Sidebar } from './sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface MobileSidebarProps {
  /** Controlled open state. If omitted, the component manages its own state. */
  isOpen?: boolean;
  onClose?: () => void;
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = React.useState(false);

  // If `isOpen` is provided (controlled mode), use it; otherwise fall back
  // to internal uncontrolled state. This avoids a setState-in-effect warning.
  const open = isOpen ?? internalOpen;
  const handleClose = React.useCallback(() => {
    if (onClose) onClose();
    setInternalOpen(false);
  }, [onClose]);

  if (!isMobile) return null;

  return (
    <Sheet isOpen={open} onClose={handleClose} side="left">
      <Sidebar className={cn('w-80 border-r-0')} onNavigate={handleClose} />
    </Sheet>
  );
}