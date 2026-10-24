'use client';

import * as React from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { loadDocumentContent, type DocumentPageContent } from '@/lib/api-client';
import type { ChatSessionDocument } from '@/types';
import { cn } from '@/lib/utils';

interface PdfPreviewerProps {
  isOpen: boolean;
  onClose: () => void;
  attachedDocs: ChatSessionDocument[];
  sessionTitle: string;
}

export function PdfPreviewer({
  isOpen,
  onClose,
  attachedDocs,
  sessionTitle,
}: PdfPreviewerProps) {
  const [activeDocId, setActiveDocId] = React.useState<string | undefined>(undefined);
  const [pages, setPages] = React.useState<DocumentPageContent[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen && attachedDocs.length > 0 && !activeDocId) {
      setActiveDocId(attachedDocs[0]?.documentId);
    }
    if (!isOpen) {
      setPages([]);
      setError(null);
      setActiveDocId(undefined);
    }
  }, [isOpen, attachedDocs, activeDocId]);

  React.useEffect(() => {
    if (!isOpen || !activeDocId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setPages([]);

    (async () => {
      try {
        const content = await loadDocumentContent(activeDocId);
        if (cancelled) return;
        setPages(content.pages);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load document';
        setError(message);
        setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, activeDocId]);

  const activeDoc = attachedDocs.find((d) => d.documentId === activeDocId);
  const displayName = activeDoc?.documentName ?? sessionTitle;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      className="w-full max-w-4xl h-[85vh] p-0 overflow-hidden"
      closeOnBackdrop
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-5 bg-surface/60 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 truncate">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-medium text-fg truncate">{displayName}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-fg-muted hover:text-fg rounded-lg hover:bg-surface-2 transition cursor-pointer shrink-0"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {attachedDocs.length > 1 && (
        <div className="flex items-center gap-1 border-b border-border bg-surface-2 px-4 py-1.5 overflow-x-auto shrink-0">
          {attachedDocs.map((doc) => (
            <button
              key={doc.documentId}
              onClick={() => setActiveDocId(doc.documentId)}
              className={cn(
                'cursor-pointer whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium transition',
                doc.documentId === activeDocId
                  ? 'bg-primary text-primary-fg'
                  : 'bg-surface text-fg-muted hover:bg-surface-3 hover:text-fg',
              )}
            >
              {doc.documentName.length > 20 ? doc.documentName.slice(0, 18) + '...' : doc.documentName}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 bg-bg overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full flex-col items-center justify-center text-fg-muted text-sm gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Loading document...</span>
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center text-fg-muted text-xs gap-2">
            <FileText className="h-10 w-10 opacity-40 text-fg-subtle" />
            <span>{error}</span>
          </div>
        ) : pages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-fg-muted text-xs gap-2">
            <FileText className="h-10 w-10 opacity-40 text-fg-subtle" />
            <span>No content available for this document.</span>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {pages.map((page) => (
              <div
                key={page.pageNumber}
                className={cn(
                  'rounded-lg border border-border bg-surface p-5 shadow-subtle',
                )}
              >
                <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                    Page {page.pageNumber}
                  </span>
                </div>
                <div className="text-sm leading-relaxed text-fg whitespace-pre-wrap font-mono">
                  {page.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
