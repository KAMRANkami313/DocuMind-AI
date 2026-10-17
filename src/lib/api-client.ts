import type {
  ApiError,
  ChatMessage,
  Citation,
  StreamMetaEvent,
  StreamTextEvent,
  UploadResponse,
} from '@/types';

export class ApiClientError extends Error {
  code?: string;
  details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.details = details;
  }
}

async function parseError(res: Response): Promise<never> {
  let body: ApiError | null = null;
  try {
    body = (await res.json()) as ApiError;
  } catch {
    // Response body was not JSON — fall through to a generic error
  }
  throw new ApiClientError(
    body?.error ?? `Request failed with status ${res.status}`,
    body?.code,
    body?.details,
  );
}

export interface UploadDocumentArgs {
  file: File;
  userId?: string;
}

export async function uploadDocument(args: UploadDocumentArgs): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', args.file);
  if (args.userId) {
    formData.append('userId', args.userId);
  }
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  if (!res.ok) await parseError(res);
  return (await res.json()) as UploadResponse;
}

export interface StreamChatArgs {
  documentId: string;
  messages: ChatMessage[];
  onCitations: (citations: Citation[]) => void;
  onText: (text: string) => void;
  signal?: AbortSignal;
}

export async function streamChat(args: StreamChatArgs): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentId: args.documentId,
      messages: args.messages,
    }),
    signal: args.signal,
  });

  if (!res.ok) await parseError(res);
  if (!res.body) {
    throw new ApiClientError('Response stream is not available');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.replace('data: ', '').trim();
      if (raw === '[DONE]') return;
      try {
        const parsed = JSON.parse(raw) as Partial<StreamMetaEvent & StreamTextEvent>;
        if (parsed.citations) {
          args.onCitations(
            parsed.citations.map((c) => ({
              chunkId: c.content,
              pageNumber: c.pageNumber,
              excerpt: c.content,
              similarity: c.similarity,
            })),
          );
        }
        if (parsed.text) {
          args.onText(parsed.text);
        }
      } catch {
        // Ignore partial stream frames
      }
    }
  }
}