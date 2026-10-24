'use client';

import { FileText, MessageSquare, Search, GitCompare, UploadCloud } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface EmptyStateProps {
  hasActiveSession: boolean;
}

export function EmptyState({ hasActiveSession }: EmptyStateProps) {
  const { user } = useAuth();

  const cards = [
    { icon: MessageSquare, title: 'Start a new chat', desc: 'Ask anything about your documents' },
    { icon: UploadCloud, title: 'Upload documents', desc: 'Add PDF or text files to chat with' },
    { icon: Search, title: 'Find specific information', desc: 'Search across your documents' },
    { icon: GitCompare, title: 'Compare documents', desc: 'Side by side analysis' },
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-soft border border-primary/30">
          <FileText className="h-10 w-10 text-primary" />
        </div>
      </div>
      <h2 className="text-2xl font-bold tracking-tight text-fg">
        {hasActiveSession ? 'Ready to chat' : 'Welcome to DocuMind AI'}
      </h2>
      <p className="mt-2 max-w-md text-sm text-fg-muted text-center">
        {hasActiveSession
          ? 'Attach a document using the paperclip button, then ask any question.'
          : user
            ? 'Click "New Chat" to start. Attach documents and ask questions with cited answers.'
            : 'Sign in to sync your documents across devices, or use guest mode.'}
      </p>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card, i) => (
          <div key={i} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-4 text-center">
            <card.icon className="h-6 w-6 text-primary" />
            <p className="text-xs font-medium text-fg">{card.title}</p>
            <p className="text-[10px] text-fg-subtle">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}