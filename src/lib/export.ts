import type { ChatMessage } from '@/types';

export function exportToMarkdown(
  messages: ChatMessage[],
  docName: string,
): string {
  let md = `# DocuMind AI — ${docName}\n\n`;
  md += `> Exported on ${new Date().toISOString()}\n\n---\n\n`;

  for (const msg of messages) {
    if (msg.role === 'user') {
      md += `### 🧑 You\n\n${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      md += `### 🤖 DocuMind AI\n\n${msg.content}\n\n`;
      if (msg.citations && msg.citations.length > 0) {
        md += `**Citations:**\n`;
        for (const cite of msg.citations) {
          md += `- Page ${cite.pageNumber} (${Math.round(cite.similarity * 100)}% match)\n`;
        }
        md += '\n';
      }
    }
  }

  return md;
}

export function exportToJSON(
  messages: ChatMessage[],
  docName: string,
): string {
  return JSON.stringify(
    {
      document: docName,
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        citations: m.citations?.map((c) => ({
          page: c.pageNumber,
          similarity: Math.round(c.similarity * 100) / 100,
        })),
        createdAt: m.createdAt,
      })),
    },
    null,
    2,
  );
}

export function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportChat(
  messages: ChatMessage[],
  docName: string,
  format: 'markdown' | 'json',
): void {
  const safeName = docName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  if (format === 'markdown') {
    const content = exportToMarkdown(messages, docName);
    downloadFile(content, `${safeName}.md`, 'text/markdown');
  } else {
    const content = exportToJSON(messages, docName);
    downloadFile(content, `${safeName}.json`, 'application/json');
  }
}