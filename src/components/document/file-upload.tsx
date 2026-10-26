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
    // ⚠️ Multi-format support: PDF, Word (.docx), Excel (.xlsx/.xls/.csv),
    // images (PNG/JPG/WEBP/GIF), and plain text (.txt/.md/.csv).
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isWord =
      file.type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      /\.docx$/i.test(file.name);
    const isExcel =
      file.type ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      /\.(xlsx|xls|csv)$/i.test(file.name);
    const isImage = /^image\/(png|jpeg|webp|gif)$/i.test(file.type) ||
      /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    const isText =
      file.type === 'text/plain' ||
      file.type === 'text/markdown' ||
      file.type === 'text/csv' ||
      /\.(txt|md|csv)$/i.test(file.name);

    if (!isPdf && !isWord && !isExcel && !isImage && !isText) {
      setStatus(
        'Error: Only PDF, DOCX, XLSX, XLS, CSV, TXT, MD, PNG, JPG, WEBP, and GIF files are allowed.',
      );
      return;
    }

    setIsLoading(true);
    setStatus('Parsing document, running OCR where needed, and creating vector embeddings...');

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
            ? 'border-primary bg-primary-soft'
            : 'border-border bg-surface hover:bg-surface-2 hover:border-border-strong',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.csv,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.gif,application/pdf,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg,image/webp,image/gif"
          disabled={isLoading}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-2">
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <UploadCloud className="h-8 w-8 text-fg-subtle group-hover:text-primary" />
          )}
          <div className="text-sm font-medium text-fg">
            {isLoading ? 'Processing Ingestion' : 'Upload Document'}
          </div>
          <p className="text-xs text-fg-subtle">
            Drag &amp; drop or click to browse (PDF, DOCX, XLSX, CSV, TXT, MD, PNG, JPG — Max 10MB)
          </p>
        </div>
      </div>

      {status && (
        <div
          className={cn(
            'mt-3 flex items-center gap-2 rounded-lg border p-2.5 text-xs',
            isError
              ? 'border-danger/30 bg-danger-soft text-danger'
              : isReady
                ? 'border-success/30 bg-success-soft text-success'
                : 'border-border bg-surface text-fg-muted',
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
