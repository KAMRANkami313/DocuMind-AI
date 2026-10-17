'use client';

import React from 'react';
import { X, FileText, ExternalLink } from 'lucide-react';

interface PdfPreviewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileBlobUrl?: string;
}

export function PdfPreviewer({ isOpen, onClose, fileName, fileBlobUrl }: PdfPreviewerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="fixed inset-0 cursor-pointer bg-black/75 backdrop-blur-sm"
      />
      <div className="relative z-10 flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950/60 px-5">
          <div className="flex items-center gap-2.5 truncate">
            <FileText className="h-4 w-4 shrink-0 text-indigo-400" />
            <span className="truncate text-xs font-medium text-zinc-200">{fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            {fileBlobUrl && (
              <a
                href={fileBlobUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-lg p-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                title="Open in new window"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-zinc-950 p-2">
          {fileBlobUrl ? (
            <iframe src={fileBlobUrl} className="h-full w-full rounded-lg border border-zinc-800" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-xs text-zinc-500">
              <FileText className="mb-2 h-10 w-10 text-indigo-400 opacity-40" />
              <span>PDF preview is available for files uploaded during this session.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
