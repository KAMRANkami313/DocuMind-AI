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
  chatSessionId: string;
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
      chatSessionId: args.chatSessionId,
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
              documentTitle: c.documentTitle,
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

export interface InsertMessageArgs {
  chatSessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
}

export interface InsertMessageResponse {
  id: string;
}

export async function insertChatMessage(
  args: InsertMessageArgs,
): Promise<InsertMessageResponse> {
  const res = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as InsertMessageResponse;
}

export interface LoadMessagesResponse {
  messages: ChatMessage[];
}

export async function loadChatMessages(
  chatSessionId: string,
): Promise<ChatMessage[]> {
  const res = await fetch(
    `/api/messages?chatSessionId=${encodeURIComponent(chatSessionId)}`,
    { method: 'GET' },
  );
  if (!res.ok) await parseError(res);
  const data = (await res.json()) as LoadMessagesResponse;
  return data.messages;
}

export async function deleteChatMessage(
  chatSessionId: string,
  messageId: string,
): Promise<void> {
  const res = await fetch(
    `/api/messages?chatSessionId=${encodeURIComponent(chatSessionId)}&messageId=${encodeURIComponent(messageId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await parseError(res);
}

export async function clearChatMessages(chatSessionId: string): Promise<void> {
  const res = await fetch(
    `/api/messages?chatSessionId=${encodeURIComponent(chatSessionId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await parseError(res);
}

export interface ChatSessionListResponse {
  sessions: Array<{
    id: string;
    title: string;
    preview?: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export async function listChatSessions(): Promise<ChatSessionListResponse['sessions']> {
  const res = await fetch('/api/chat-sessions', { method: 'GET' });
  if (!res.ok) await parseError(res);
  const data = (await res.json()) as ChatSessionListResponse;
  return data.sessions;
}

export async function createChatSession(): Promise<{
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}> {
  const res = await fetch('/api/chat-sessions', { method: 'POST' });
  if (!res.ok) await parseError(res);
  return await res.json();
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const res = await fetch(
    `/api/chat-sessions?id=${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await parseError(res);
}

export interface LoadSessionResponse {
  id: string;
  title: string;
  messages: ChatMessage[];
  documents: Array<{ documentId: string; documentName: string }>;
}

export async function loadChatSession(sessionId: string): Promise<LoadSessionResponse> {
  const res = await fetch(`/api/chat-sessions/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as LoadSessionResponse;
}

export async function renameChatSession(
  sessionId: string,
  title: string,
): Promise<void> {
  const res = await fetch(`/api/chat-sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) await parseError(res);
}

export async function attachDocumentToSession(
  sessionId: string,
  documentId: string,
): Promise<{ documentId: string; documentName: string }> {
  const res = await fetch(
    `/api/chat-sessions/${encodeURIComponent(sessionId)}/documents`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId }),
    },
  );
  if (!res.ok) await parseError(res);
  return await res.json();
}

export interface DocumentPageContent {
  pageNumber: number;
  text: string;
}

export interface DocumentContentResponse {
  id: string;
  title: string;
  fileName: string;
  pages: DocumentPageContent[];
}

export async function loadDocumentContent(
  documentId: string,
): Promise<DocumentContentResponse> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: 'GET',
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as DocumentContentResponse;
}

export async function renameDocument(
  documentId: string,
  title: string,
): Promise<void> {
  const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) await parseError(res);
}