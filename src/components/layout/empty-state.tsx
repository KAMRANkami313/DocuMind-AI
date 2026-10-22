'use client';

import { FileText, Sparkles, UploadCloud } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  hasActiveDoc: boolean;
}

export function EmptyState({ hasActiveDoc }: EmptyStateProps) {
  const { user } = useAuth();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center py-12">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-soft border border-primary/30">
          {hasActiveDoc ? (
            <FileText className="h-10 w-10 text-primary" />
          ) : (
            <Sparkles className="h-10 w-10 text-primary" />
          )}
        </div>
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-fg">
        {hasActiveDoc ? 'Ready to chat' : 'Welcome to DocuMind AI'}
      </h2>
      <p
        className={cn(
          'mt-2 max-w-md text-sm leading-relaxed',
          'text-fg-muted',
        )}
      >
        {hasActiveDoc
          ? 'Your document is loaded. Type a question below, or pick a suggested follow-up from any previous answer.'
          : user
            ? 'Upload a PDF to start analyzing. Your documents and chat history sync automatically.'
            : 'Upload any PDF to start chatting instantly. Guest mode keeps everything local to this browser.'}
      </p>

      {!hasActiveDoc && (
        <div className="mt-6 flex items-center gap-2 text-xs text-fg-subtle">
          <UploadCloud className="h-3.5 w-3.5" />
          <span>Drag and drop a PDF into the sidebar to begin</span>
        </div>
      )}
    </div>
  );
}