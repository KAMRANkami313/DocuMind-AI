'use client';

import * as React from 'react';
import { Send, Paperclip, Loader2, X } from 'lucide-react';
import { useChat } from '@/hooks/use-chat';
import { StopButton } from '@/components/chat/stop-button';
import { MAX_DOCUMENTS_PER_CHAT } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function ChatInput() {
  const { input, setInput, isLoading, activeSession, handleSubmit, isStreaming, stopGeneration, attachedDocs, documents, attachDocument, uploadAndAttachDocument } = useChat();
  const [attachOpen, setAttachOpen] = React.useState(false);
  const attachRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) setAttachOpen(false);
    }
    if (attachOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [attachOpen]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!isLoading && input.trim() && activeSession) void handleSubmit();
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void handleSubmit();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadAndAttachDocument(file);
    setAttachOpen(false);
    e.target.value = '';
  }

  const canAttach = attachedDocs.length < MAX_DOCUMENTS_PER_CHAT;

  return (
    <div className="border-t border-border bg-surface/60 p-3 sm:p-4 backdrop-blur-md">
      <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-center gap-2">
        <div className="relative" ref={attachRef}>
          <button
            type="button"
            onClick={() => canAttach && setAttachOpen(!attachOpen)}
            disabled={!canAttach || !activeSession || isLoading}
            className={cn(
              'flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition',
              canAttach ? 'border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-primary' : 'border-border bg-surface text-fg-subtle opacity-50',
            )}
            title={canAttach ? `Attach document (${attachedDocs.length}/${MAX_DOCUMENTS_PER_CHAT})` : 'Document limit reached'}
            aria-label="Attach document"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          {attachOpen && (
            <div className="absolute bottom-12 left-0 z-50 w-64 rounded-lg border border-border bg-surface shadow-elevated py-1 max-h-64 overflow-y-auto">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
              >
                <Paperclip className="h-3.5 w-3.5 text-primary" /> Upload new document
              </button>
              <div className="border-t border-border my-1" />
              {documents.length === 0 ? (
                <p className="px-3 py-2 text-[10px] text-fg-subtle italic">No documents in library.</p>
              ) : (
                documents
                  .filter((d) => !attachedDocs.some((a) => a.documentId === d.id))
                  .map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => { void attachDocument(doc.id, doc.name); setAttachOpen(false); }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
                    >
                      <span className="truncate">{doc.name}</span>
                    </button>
                  ))
              )}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={handleFileSelect} className="hidden" />
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            !activeSession ? 'Create a new chat to start...' :
            attachedDocs.length === 0 ? 'Attach a document first...' :
            'Ask anything about your documents...'
          }
          disabled={isLoading || !activeSession || attachedDocs.length === 0}
          className={cn(
            'flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg',
            'placeholder-fg-subtle transition focus:border-primary focus:outline-none disabled:opacity-50',
          )}
        />

        {isStreaming ? (
          <StopButton onClick={stopGeneration} />
        ) : (
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !activeSession || attachedDocs.length === 0}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition',
              'bg-primary text-primary-fg hover:bg-primary-hover',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'shadow-md shadow-primary/25',
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
      {attachedDocs.length > 0 && (
        <p className="mx-auto mt-1.5 max-w-3xl text-[10px] text-fg-subtle">
          {attachedDocs.length}/{MAX_DOCUMENTS_PER_CHAT} documents attached
        </p>
      )}
    </div>
  );
}
