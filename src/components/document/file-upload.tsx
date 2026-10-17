'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface FileUploadProps {
  userId?: string;
  onUploadSuccess: (document: { id: string; name: string; blobUrl?: string }) => void;
}

export function FileUpload({ userId, onUploadSuccess }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload document');
      }

      setStatus(`Ready! Processed ${data.totalChunks} chunks.`);
      onUploadSuccess({ id: data.documentId, name: data.fileName, blobUrl });
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) processFile(file);
        }}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all duration-200 ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          disabled={isLoading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
          }}
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
          <p className="text-xs text-zinc-500">Drag & drop or click to browse (Max 10MB)</p>
        </div>
      </div>

      {status && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-lg border p-2.5 text-xs ${
            status.startsWith('Error')
              ? 'border-red-800/60 bg-red-950/40 text-red-300'
              : status.startsWith('Ready')
                ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400'
          }`}
        >
          {status.startsWith('Error') ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : status.startsWith('Ready') ? (
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
