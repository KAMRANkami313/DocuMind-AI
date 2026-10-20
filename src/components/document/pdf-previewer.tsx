'use client';

import * as React from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { loadDocumentContent, type DocumentPageContent } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface PdfPreviewerProps {
  isOpen: boolean;
  onClose: () => void;
  documentId?: string;
  fileName: string;
  fileBlobUrl?: string;
}

export function PdfPreviewer({
  isOpen,
  onClose,
  documentId,
  fileName,
  fileBlobUrl,
}: PdfPreviewerProps) {
  const [pages, setPages] = React.useState<DocumentPageContent[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setPages([]);
      setError(null);
      return;
    }

    if (fileBlobUrl) {
      setPages([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (!documentId) {
      setPages([]);
      setError('No document selected.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const content = await loadDocumentContent(documentId);
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

    return () => {
      cancelled = true;
    };
  }, [isOpen, documentId, fileBlobUrl]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      className="w-full max-w-4xl h-[85vh] p-0 overflow-hidden"
      closeOnBackdrop
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-4 sm:px-5 bg-surface/60">
        <div className="flex items-center gap-2.5 truncate">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-medium text-fg truncate">{fileName}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-fg-muted hover:text-fg rounded-lg hover:bg-surface-2 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 bg-bg overflow-y-auto p-4">
        {fileBlobUrl ? (
          <iframe
            src={fileBlobUrl}
            className="w-full h-full rounded-lg border border-border"
            title={fileName}
          />
        ) : isLoading ? (
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
