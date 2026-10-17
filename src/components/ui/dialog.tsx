'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
}

const subscribe = () => () => {};

export function Dialog({
  isOpen,
  onClose,
  children,
  className,
  closeOnBackdrop = true,
}: DialogProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={closeOnBackdrop ? onClose : undefined}
        className={cn(
          'absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in',
          closeOnBackdrop && 'cursor-pointer',
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 bg-surface border border-border rounded-xl shadow-elevated flex flex-col max-h-[90vh] animate-in zoom-in-95 fade-in',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface DialogHeaderProps {
  title?: React.ReactNode;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function DialogHeader({ title, onClose, children, className }: DialogHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border p-4',
        className,
      )}
    >
      <div className="text-base font-semibold text-fg">{title ?? children}</div>
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

export function DialogBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('p-4', className)}>{children}</div>;
}

export function DialogFooter({
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