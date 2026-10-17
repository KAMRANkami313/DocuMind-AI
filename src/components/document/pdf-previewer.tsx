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
      <div onClick={onClose} className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer" />
      <div className="relative w-full max-w-4xl h-[85vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden">
        <div className="h-14 border-b border-zinc-800 px-5 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5 truncate">
            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-xs font-medium text-zinc-200 truncate">{fileName}</span>
          </div>
          <div className="flex items-center gap-2">
            {fileBlobUrl && (
              <a
                href={fileBlobUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition flex items-center gap-1 text-xs"
                title="Open in new window"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-zinc-950 p-2">
          {fileBlobUrl ? (
            <iframe src={fileBlobUrl} className="w-full h-full rounded-lg border border-zinc-800" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 text-xs">
              <FileText className="w-10 h-10 mb-2 opacity-40 text-indigo-400" />
              <span>PDF preview is available for files uploaded during this session.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}