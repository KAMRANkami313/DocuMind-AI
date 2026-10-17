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
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-600/10">
          {hasActiveDoc ? (
            <FileText className="h-10 w-10 text-indigo-400" />
          ) : (
            <Sparkles className="h-10 w-10 text-indigo-400" />
          )}
        </div>
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-white">
        {hasActiveDoc ? 'Ready to chat' : 'Welcome to DocuMind AI'}
      </h2>
      <p
        className={cn(
          'mt-2 max-w-md text-sm leading-relaxed',
          'text-zinc-400',
        )}
      >
        {hasActiveDoc
          ? 'Your document is loaded. Type a question in the box below, or pick a suggested follow-up from any previous answer.'
          : user
            ? 'Upload a PDF to start analyzing across all your devices. Your documents and chat history sync automatically.'
            : 'Upload any PDF to start chatting instantly without an account. Guest mode keeps everything local to this browser.'}
      </p>

      {!hasActiveDoc && (
        <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
          <UploadCloud className="h-3.5 w-3.5" />
          <span>Drag and drop a PDF into the sidebar to begin</span>
        </div>
      )}
    </div>
  );
}