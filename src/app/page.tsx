'use client';

import { useState } from 'react';

export default function Home() {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus('Processing PDF & generating vectors (first run downloads the AI model)...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setStatus(`✅ Success! Document ID: ${data.documentId} | Total Chunks: ${data.totalChunks}`);
      } else {
        setStatus(`❌ Error: ${data.error}`);
      }
    } catch (err: any) {
      setStatus(`❌ Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-zinc-950 text-white font-sans">
      <div className="w-full max-w-md p-6 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
        <h1 className="text-xl font-bold tracking-tight">Test Document Ingestion</h1>
        <p className="text-sm text-zinc-400">Select any PDF to extract, chunk, embed, and store in Supabase.</p>
        <input
          type="file"
          accept="application/pdf"
          disabled={loading}
          onChange={handleUpload}
          className="w-full text-sm text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
        />
        {status && <p className="text-xs p-3 bg-zinc-800/80 rounded border border-zinc-700 wrap-break-word">{status}</p>}
      </div>
    </main>
  );
}