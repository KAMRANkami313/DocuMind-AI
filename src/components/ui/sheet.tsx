'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: 'left' | 'right';
  className?: string;
  overlayClassName?: string;
}

const subscribe = () => () => {};

export function Sheet({
  isOpen,
  onClose,
  children,
  side = 'right',
  className,
  overlayClassName,
}: SheetProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    // Lock body scroll while the drawer is open. The drawer's inner content
    // (Sidebar) provides its own scroll region via `overscroll-contain`, so
    // locking the body prevents the page underneath from being dragged along
    // with mobile touch scroll (a common iOS Safari issue).
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  const isClient = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!isClient || !isOpen) return null;

  const sideClasses =
    side === 'left'
      ? 'left-0 border-r animate-in slide-in-from-left-full'
      : 'right-0 border-l animate-in slide-in-from-right-full';

  return createPortal(
    // Outer wrapper: fixed inset-0 + z-50 covers the whole viewport.
    // `touch-none` on the overlay so touches on the overlay close the drawer
    // instead of scrolling the page behind it.
    <div className="fixed inset-0 z-50">
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 touch-none cursor-pointer bg-black/60 backdrop-blur-sm animate-in fade-in',
          overlayClassName,
        )}
      />
      {/* Panel: absolute top-0 bottom-0 + flex-col + h-full so the child
          Sidebar's `h-full` resolves to the full viewport height. Without
          this, the Sidebar's inner `flex-1 overflow-y-auto` had no bounded
          height and silently failed to scroll on touch devices. */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'absolute top-0 bottom-0 flex h-full w-full max-w-md flex-col bg-surface border-border shadow-elevated',
          sideClasses,
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface SheetHeaderProps {
  title?: React.ReactNode;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function SheetHeader({ title, onClose, children, className }: SheetHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border p-4',
        className,
      )}
    >
      <div className="text-sm font-semibold text-fg">{title ?? children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function SheetBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4', className)}>
      {children}
    </div>
  );
}

export function SheetFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-t border-border p-4 flex justify-end gap-2',
        className,
      )}
    >
      {children}
    </div>
  );
}