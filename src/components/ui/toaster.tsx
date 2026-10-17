'use client';

import { ToastViewport } from './toast';
import { useToast } from '@/hooks/use-toast';

export function Toaster() {
  const { toasts, dismiss } = useToast();
  return <ToastViewport toasts={toasts} onDismiss={dismiss} />;
}
