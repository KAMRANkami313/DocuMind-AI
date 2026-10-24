'use client';

import { Sheet } from '@/components/ui/sheet';
import { Sidebar } from './sidebar';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  return (
    <div className="lg:hidden">
      <Sheet isOpen={isOpen} onClose={onClose} side="left">
        <Sidebar
          className="border-r-0 w-80 max-w-[85vw]"
          onNavigate={onClose}
        />
      </Sheet>
    </div>
  );
}