'use client';

import * as React from 'react';
import type { Toast } from '@/types';
import { generateId } from '@/lib/utils';

type ToastInput = Omit<Toast, 'id' | 'duration'> & {
  duration?: number;
};

interface ToastContextValue {
  toasts: Toast[];
  toast: (input: ToastInput) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = React.useCallback(() => setToasts([]), []);

  const toast = React.useCallback((input: ToastInput) => {
    const id = generateId('toast');
    const next: Toast = {
      id,
      title: input.title,
      description: input.description,
      variant: input.variant,
      duration: input.duration ?? DEFAULT_DURATION,
    };
    setToasts((prev) => [...prev, next]);
    return id;
  }, []);

  const success = React.useCallback(
    (title: string, description?: string) => toast({ title, description, variant: 'success' }),
    [toast],
  );

  const error = React.useCallback(
    (title: string, description?: string) =>
      toast({ title, description, variant: 'error', duration: 8000 }),
    [toast],
  );

  const warning = React.useCallback(
    (title: string, description?: string) => toast({ title, description, variant: 'warning' }),
    [toast],
  );

  const info = React.useCallback(
    (title: string, description?: string) => toast({ title, description, variant: 'info' }),
    [toast],
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({ toasts, toast, success, error, warning, info, dismiss, dismissAll }),
    [toasts, toast, success, error, warning, info, dismiss, dismissAll],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToastContext(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return ctx;
}
