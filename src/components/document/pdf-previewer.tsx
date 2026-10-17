'use client';

import { FileText, ExternalLink, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';

interface PdfPreviewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileBlobUrl?: string;
}

export function PdfPreviewer({
  isOpen,
  onClose,
  fileName,
  fileBlobUrl,
}: PdfPreviewerProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      className="w-full max-w-4xl h-[85vh] p-0 overflow-hidden"
      closeOnBackdrop
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-5 bg-surface/60">
        <div className="flex items-center gap-2.5 truncate">
          <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
          <span className="text-xs font-medium text-fg truncate">{fileName}</span>
        </div>
        <div className="flex items-center gap-1">
          {fileBlobUrl && (
            <a
              href={fileBlobUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-fg-muted hover:text-fg rounded-lg hover:bg-surface-2 transition flex items-center gap-1 text-xs cursor-pointer"
              title="Open in new window"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-fg-muted hover:text-fg rounded-lg hover:bg-surface-2 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-bg p-2 overflow-hidden">
        {fileBlobUrl ? (
          <iframe
            src={fileBlobUrl}
            className="w-full h-full rounded-lg border border-border"
            title={fileName}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-fg-muted text-xs">
            <FileText className="h-10 w-10 mb-2 opacity-40 text-indigo-400" />
            <span>
              PDF preview is available for files uploaded during this session.
            </span>
          </div>
        )}
      </div>
    </Dialog>
  );
}