'use client';

import * as React from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  userId?: string;
  onUploadSuccess: (document: { id: string; name: string; blobUrl?: string }) => void;
}

interface UploadSuccessResponse {
  success: true;
  documentId: string;
  fileName: string;
  totalChunks: number;
}

interface UploadErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export function FileUpload({ userId, onUploadSuccess }: FileUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [status, setStatus] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    if (file.type !== 'application/pdf') {
      setStatus('Error: Only PDF documents are allowed.');
      return;
    }

    setIsLoading(true);
    setStatus('Parsing document & creating vector embeddings...');

    const formData = new FormData();
    formData.append('file', file);
    if (userId) {
      formData.append('userId', userId);
    }

    const blobUrl = URL.createObjectURL(file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const raw = (await res.json()) as UploadSuccessResponse | UploadErrorResponse;

      if ('success' in raw && raw.success) {
        setStatus(`Ready! Processed ${raw.totalChunks} chunks.`);
        onUploadSuccess({
          id: raw.documentId,
          name: raw.fileName,
          blobUrl,
        });
      } else if ('error' in raw) {
        throw new Error(raw.error);
      } else {
        throw new Error('Failed to upload document');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload document';
      setStatus(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  }

  const isError = status.startsWith('Error');
  const isReady = status.startsWith('Ready');

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          'cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all duration-200',
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          disabled={isLoading}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-2">
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          ) : (
            <UploadCloud className="h-8 w-8 text-zinc-400 group-hover:text-indigo-400" />
          )}
          <div className="text-sm font-medium text-zinc-200">
            {isLoading ? 'Processing Ingestion' : 'Upload PDF Document'}
          </div>
          <p className="text-xs text-zinc-500">
            Drag &amp; drop or click to browse (Max 10MB)
          </p>
        </div>
      </div>

      {status && (
        <div
          className={cn(
            'mt-3 flex items-center gap-2 rounded-lg border p-2.5 text-xs',
            isError
              ? 'border-red-800/60 bg-red-950/40 text-red-300'
              : isReady
                ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400',
          )}
        >
          {isError ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : isReady ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          )}
          <span className="truncate">{status}</span>
        </div>
      )}
    </div>
  );
}