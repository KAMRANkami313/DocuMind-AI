'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Toast } from '@/types';

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const variantConfig = {
  default: {
    icon: Info,
    iconClass: 'text-fg-muted',
    containerClass: 'bg-surface text-fg',
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'text-success',
    containerClass: 'bg-surface text-fg border-success/30',
  },
  error: {
    icon: AlertCircle,
    iconClass: 'text-danger',
    containerClass: 'bg-surface text-fg border-danger/30',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-warning',
    containerClass: 'bg-surface text-fg border-warning/30',
  },
  info: {
    icon: Info,
    iconClass: 'text-primary',
    containerClass: 'bg-surface text-fg border-primary/30',
  },
} as const;

export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const config = variantConfig[toast.variant] ?? variantConfig.default;
  const Icon = config.icon;

  React.useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'animate-in slide-in-from-right-full fade-in shadow-elevated pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-3.5',
        config.containerClass,
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', config.iconClass)} />
      <div className="flex-1 space-y-0.5">
        <p className="text-sm leading-tight font-medium">{toast.title}</p>
        {toast.description && <p className="text-fg-muted text-xs">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="text-fg-subtle hover:text-fg transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const subscribe = () => () => {};

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  const isClient = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!isClient) return null;

  return createPortal(
    <div className="pointer-events-none fixed right-4 bottom-4 z-100 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}