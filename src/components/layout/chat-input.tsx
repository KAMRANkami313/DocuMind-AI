'use client';

import * as React from 'react';
import { Send, Paperclip, Loader2 } from 'lucide-react';
import { useChat } from '@/hooks/use-chat';
import { StopButton } from '@/components/chat/stop-button';
import { MAX_DOCUMENTS_PER_CHAT } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function ChatInput() {
  const {
    input,
    setInput,
    isLoading,
    activeSession,
    handleSubmit,
    isStreaming,
    stopGeneration,
    attachedDocs,
    documents,
    attachDocument,
    uploadAndAttachDocument,
    // ⚠️ isUploading: true while a document is being uploaded via the
    // paperclip button. Shows a spinner on the paperclip button and
    // disables input + send so the user can't submit a half-uploaded
    // chat session.
    isUploading,
  } = useChat();
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
      if (!isLoading && !isUploading && input.trim() && activeSession) void handleSubmit();
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

  // Disable input while: streaming a reply, uploading a document, no
  // active session, or no docs attached yet (chat requires at least one
  // doc to be answerable).
  const inputDisabled = isLoading || isUploading || !activeSession || attachedDocs.length === 0;
  const sendDisabled = isLoading || isUploading || !input.trim() || !activeSession || attachedDocs.length === 0;
  const attachDisabled = !canAttach || !activeSession || isLoading || isUploading;

  return (
    <div className="border-t border-border bg-surface/60 p-3 sm:p-4 backdrop-blur-md">
      <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-center gap-2">
        <div className="relative" ref={attachRef}>
          <button
            type="button"
            onClick={() => canAttach && !isUploading && setAttachOpen(!attachOpen)}
            disabled={attachDisabled}
            className={cn(
              'flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition',
              attachDisabled
                ? 'border-border bg-surface text-fg-subtle opacity-50'
                : 'border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-primary',
              // ⚠️ Highlight the paperclip while uploading so the user
              // sees where the activity is happening.
              isUploading && 'border-primary/40 bg-primary-soft text-primary',
            )}
            title={
              isUploading
                ? 'Uploading document…'
                : canAttach
                  ? `Attach document (${attachedDocs.length}/${MAX_DOCUMENTS_PER_CHAT})`
                  : 'Document limit reached'
            }
            aria-label="Attach document"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </button>
          {attachOpen && !isUploading && (
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
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.gif,application/pdf,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg,image/webp,image/gif" onChange={handleFileSelect} className="hidden" />
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isUploading ? 'Uploading document…' :
            !activeSession ? 'Create a new chat to start...' :
            attachedDocs.length === 0 ? 'Attach a document first...' :
            'Ask anything about your documents...'
          }
          disabled={inputDisabled}
          className={cn(
            'flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg',
            'placeholder-fg-subtle transition focus:border-primary focus:outline-none disabled:opacity-50',
            isUploading && 'border-primary/40',
          )}
        />

        {isStreaming ? (
          <StopButton onClick={stopGeneration} />
        ) : (
          <button
            type="submit"
            disabled={sendDisabled}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition',
              'bg-primary text-primary-fg hover:bg-primary-hover',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'shadow-md shadow-primary/25',
            )}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        )}
      </form>
      {/* ⚠️ Visible upload progress line below the input bar */}
      {isUploading && (
        <div className="mx-auto mt-2 flex max-w-3xl items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft px-3 py-1.5 text-[11px] text-primary">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          <span className="truncate">Processing document — parsing, OCR, and embedding…</span>
        </div>
      )}
      {attachedDocs.length > 0 && !isUploading && (
        <p className="mx-auto mt-1.5 max-w-3xl text-[10px] text-fg-subtle">
          {attachedDocs.length}/{MAX_DOCUMENTS_PER_CHAT} documents attached
        </p>
      )}
    </div>
  );
}
