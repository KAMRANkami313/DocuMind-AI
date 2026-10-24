'use client';

import * as React from 'react';
import { useAuthContext } from './auth-provider';
import { useToastContext } from './toast-provider';
import {
  streamChat,
  insertChatMessage,
  deleteChatMessage,
  clearChatMessages,
  listChatSessions,
  createChatSession,
  deleteChatSession,
  loadChatSession,
  renameChatSession,
  attachDocumentToSession,
  uploadDocument,
} from '@/lib/api-client';
import type {
  ChatMessage,
  Citation,
  ChatSession,
  ChatSessionDocument,
  DocumentMeta,
} from '@/types';
import { MAX_DOCUMENTS_PER_CHAT } from '@/lib/constants';
import { generateId } from '@/lib/utils';
// Static import avoids the dynamic-import latency on every mount.
// 'use client' ensures this only runs in the browser, so SSR is safe.
import { supabase as browserSupabase } from '@/lib/supabase/client';

interface ChatContextValue {
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  messages: ChatMessage[];
  attachedDocs: ChatSessionDocument[];
  documents: DocumentMeta[];
  input: string;
  isLoading: boolean;
  isStreaming: boolean;
  selectedCitation: Citation | null;
  isDrawerOpen: boolean;
  isPreviewOpen: boolean;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setIsPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedCitation: React.Dispatch<React.SetStateAction<Citation | null>>;
  createNewChat: () => Promise<void>;
  selectChat: (sessionId: string) => void;
  deleteChat: (sessionId: string) => Promise<void>;
  renameChat: (sessionId: string, title: string) => Promise<void>;
  attachDocument: (documentId: string, documentName: string) => Promise<void>;
  uploadAndAttachDocument: (file: File) => Promise<void>;
  handleSubmit: () => Promise<void>;
  handleSendSuggestion: (suggestion: string) => Promise<void>;
  handleRegenerate: () => Promise<void>;
  stopGeneration: () => void;
  handleInPlaceEdit: (index: number, newText: string) => Promise<void>;
  deleteSpecificMessage: (index: number) => Promise<void>;
  clearActiveChat: () => Promise<void>;
  openCitation: (citation: Citation) => void;
}

const ChatContext = React.createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const { error: showError, success: showSuccess } = useToastContext();

  const [sessions, setSessions] = React.useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [attachedDocs, setAttachedDocs] = React.useState<ChatSessionDocument[]>([]);
  const [documents, setDocuments] = React.useState<DocumentMeta[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [selectedCitation, setSelectedCitation] = React.useState<Citation | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  const abortControllerRef = React.useRef<AbortController | null>(null);

  const activeSession = React.useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  React.useEffect(() => {
    let active = true;
    async function loadSessionsAndDocs() {
      if (!user) return;
      // ⚡ Performance: fetch sessions + documents in parallel instead of
      // sequentially. The old code awaited listChatSessions(), THEN awaited
      // a dynamic import, THEN awaited the documents query — adding ~150-300ms
      // of unnecessary serial latency on every mount / page refresh.
      // We use Promise.allSettled so one failure doesn't sink the other.
      const [sessResult, docsResult] = await Promise.allSettled([
        listChatSessions(),
        browserSupabase
          .from('documents')
          .select('id, title, file_name')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (!active) return;

      if (sessResult.status === 'fulfilled') {
        const sessList = sessResult.value;
        setSessions(sessList);
        if (sessList.length > 0) {
          setActiveSessionId((prev) => prev ?? sessList[0]!.id);
        }
      } else {
        const message = sessResult.reason instanceof Error ? sessResult.reason.message : 'Unknown error';
        showError('Failed to load chat sessions', message);
      }

      if (docsResult.status === 'fulfilled') {
        const userDocs = docsResult.value.data as
          | Array<{ id: string; file_name: string | null; title: string | null }>
          | null;
        if (userDocs) {
          const formatted: DocumentMeta[] = userDocs.map((d) => ({
            id: d.id,
            name: d.file_name ?? d.title ?? 'Untitled',
          }));
          setDocuments(formatted);
        }
      }
      // Document library load failure is non-critical — silently ignored.
    }
    if (user) {
      void loadSessionsAndDocs();
    } else {
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
      setAttachedDocs([]);
      setDocuments([]);
    }
    return () => { active = false; };
  }, [user, showError]);

  React.useEffect(() => {
    let active = true;
    async function loadSessionData() {
      if (!activeSessionId || !user) {
        setMessages([]);
        setAttachedDocs([]);
        return;
      }
      try {
        const data = await loadChatSession(activeSessionId);
        if (!active) return;
        setMessages(data.messages);
        setAttachedDocs(data.documents);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (active) showError('Failed to load chat', message);
      }
    }
    void loadSessionData();
    return () => { active = false; };
  }, [activeSessionId, user, showError]);

  const createNewChat = React.useCallback(async () => {
    if (activeSession && messages.length === 0 && attachedDocs.length === 0) {
      return;
    }
    if (!user) {
      // Guest mode: create a local-only session (no DB row).
      const guestId = generateId('guest-session');
      const newSess: ChatSession = {
        id: guestId,
        title: 'New Chat',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSessions((prev) => [newSess, ...prev]);
      setActiveSessionId(guestId);
      setMessages([]);
      setAttachedDocs([]);
      return;
    }
    try {
      const newSess = await createChatSession();
      setSessions((prev) => [{ id: newSess.id, title: newSess.title, createdAt: newSess.createdAt, updatedAt: newSess.updatedAt }, ...prev]);
      setActiveSessionId(newSess.id);
      setMessages([]);
      setAttachedDocs([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      showError('Failed to create chat', message);
    }
  }, [activeSession, messages, attachedDocs, user, showError]);

  const selectChat = React.useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  const deleteChat = React.useCallback(async (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);
    if (activeSessionId === sessionId) {
      setActiveSessionId(updated.length > 0 ? updated[0]!.id : null);
    }
    if (user) {
      try {
        await deleteChatSession(sessionId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        showError('Failed to delete chat', message);
      }
    }
    showSuccess('Chat deleted', target ? `"${target.title}" was removed.` : undefined);
  }, [sessions, activeSessionId, user, showError, showSuccess]);

  const renameChat = React.useCallback(async (sessionId: string, title: string) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title } : s)));
    if (user) {
      try {
        await renameChatSession(sessionId, title);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        showError('Failed to rename chat', message);
      }
    }
  }, [user, showError]);

  const attachDocument = React.useCallback(async (documentId: string, documentName: string) => {
    if (!activeSessionId) return;
    if (attachedDocs.length >= MAX_DOCUMENTS_PER_CHAT) {
      showError('Document limit reached', `Max ${MAX_DOCUMENTS_PER_CHAT} documents per chat.`);
      return;
    }
    if (attachedDocs.some((d) => d.documentId === documentId)) return;
    setAttachedDocs((prev) => [...prev, { documentId, documentName }]);
    // Auto-derive session title from the first attached document
    if (attachedDocs.length === 0) {
      setSessions((prev) => prev.map((s) => (s.id === activeSessionId ? { ...s, title: documentName, updatedAt: new Date().toISOString() } : s)));
      if (user) {
        try { await renameChatSession(activeSessionId, documentName); } catch { /* best-effort */ }
      }
    }
    if (user) {
      try {
        await attachDocumentToSession(activeSessionId, documentId);
        showSuccess('Document attached', `"${documentName}" added to this chat.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        showError('Failed to attach document', message);
      }
    } else {
      showSuccess('Document attached', `"${documentName}" added to this chat.`);
    }
  }, [activeSessionId, attachedDocs, user, showError, showSuccess]);

  const uploadAndAttachDocument = React.useCallback(async (file: File) => {
    if (!activeSessionId) return;
    if (attachedDocs.length >= MAX_DOCUMENTS_PER_CHAT) {
      showError('Document limit reached', `Max ${MAX_DOCUMENTS_PER_CHAT} documents per chat.`);
      return;
    }
    try {
      const result = await uploadDocument({ file, userId: user?.id });
      if (user) {
        await attachDocumentToSession(activeSessionId, result.documentId);
      }
      setAttachedDocs((prev) => [...prev, { documentId: result.documentId, documentName: result.fileName }]);
      setDocuments((prev) => [{ id: result.documentId, name: result.fileName }, ...prev.filter((d) => d.id !== result.documentId)]);
      // Auto-derive session title from the first uploaded document
      if (attachedDocs.length === 0) {
        setSessions((prev) => prev.map((s) => (s.id === activeSessionId ? { ...s, title: result.fileName, updatedAt: new Date().toISOString() } : s)));
        if (user) {
          try { await renameChatSession(activeSessionId, result.fileName); } catch { /* best-effort */ }
        }
      }
      showSuccess('Document uploaded', `"${result.fileName}" attached to this chat.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      showError('Failed to upload document', message);
    }
  }, [activeSessionId, attachedDocs, user, showError, showSuccess]);

  const sendChatRequest = React.useCallback(async (messagesToSend: ChatMessage[]) => {
    if (!activeSessionId) return;
    const sessionId = activeSessionId;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setMessages(messagesToSend);
    setIsLoading(true);
    setIsStreaming(true);

    if (user) {
      const lastUser = messagesToSend[messagesToSend.length - 1];
      if (lastUser) {
        try {
          await insertChatMessage({ chatSessionId: sessionId, role: 'user', content: lastUser.content });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          showError('Failed to save your message', message);
        }
      }
    }

    let assistantText = '';
    let retrievedCitations: Citation[] = [];

    setMessages((prev) => [...prev, { role: 'assistant', content: '', citations: [] }]);

    try {
      await streamChat({
        chatSessionId: sessionId,
        messages: messagesToSend,
        // Guest mode: the chat_sessions row doesn't exist in Postgres,
        // so pass the attached document IDs explicitly for retrieval.
        documentIds: !user ? attachedDocs.map((d) => d.documentId) : undefined,
        signal: abortController.signal,
        onCitations: (citations) => { retrievedCitations = citations; },
        onText: (text) => {
          assistantText += text;
          setMessages((prev) => {
            const session = [...prev];
            const lastIndex = session.length - 1;
            const last = session[lastIndex];
            if (!last) return prev;
            session[lastIndex] = { role: 'assistant', content: assistantText, citations: retrievedCitations };
            return session;
          });
        },
      });

      if (user && assistantText) {
        try {
          await insertChatMessage({ chatSessionId: sessionId, role: 'assistant', content: assistantText, citations: retrievedCitations });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          showError('Failed to save assistant response', message);
        }
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        if (user && assistantText) {
          try {
            await insertChatMessage({ chatSessionId: sessionId, role: 'assistant', content: assistantText + '\n\n_⏹ Generation stopped_', citations: retrievedCitations });
          } catch { /* best-effort */ }
        }
      } else {
        const message = err instanceof Error ? err.message : 'Unknown server error';
        showError('Failed to fetch response', message);
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${message}` }]);
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [activeSessionId, user, attachedDocs, showError]);

  const stopGeneration = React.useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
  }, []);

  const handleSubmit = React.useCallback(async () => {
    if (!input.trim() || isLoading) return;
    if (!activeSessionId) { showError('No active chat', 'Create a new chat first.'); return; }
    if (attachedDocs.length === 0) { showError('No documents attached', 'Please attach a document to start chatting.'); return; }
    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const messagesToSend = [...messages, userMessage];
    setInput('');
    await sendChatRequest(messagesToSend);
  }, [input, isLoading, activeSessionId, attachedDocs, messages, sendChatRequest, showError]);

  const handleSendSuggestion = React.useCallback(async (suggestion: string) => {
    if (!suggestion.trim() || isLoading || !activeSessionId) return;
    const userMessage: ChatMessage = { role: 'user', content: suggestion.trim() };
    await sendChatRequest([...messages, userMessage]);
  }, [isLoading, activeSessionId, messages, sendChatRequest]);

  const handleRegenerate = React.useCallback(async () => {
    if (!activeSessionId || isLoading) return;
    if (messages.length < 2) return;
    const lastAssistantIdx = messages.length - 1;
    const lastAssistant = messages[lastAssistantIdx];
    if (!lastAssistant || lastAssistant.role !== 'assistant') return;
    let lastUserIdx = lastAssistantIdx - 1;
    while (lastUserIdx >= 0 && messages[lastUserIdx]?.role !== 'user') lastUserIdx -= 1;
    if (lastUserIdx < 0) return;
    const lastUser = messages[lastUserIdx];
    if (!lastUser) return;
    const truncated = messages.slice(0, lastUserIdx);
    const messagesToSend = [...truncated, { role: 'user' as const, content: lastUser.content }];
    if (lastAssistant.id && user) {
      try { await deleteChatMessage(activeSessionId, lastAssistant.id); } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        showError('Failed to regenerate', message); return;
      }
    }
    await sendChatRequest(messagesToSend);
  }, [activeSessionId, isLoading, messages, sendChatRequest, showError, user]);

  const handleInPlaceEdit = React.useCallback(async (index: number, newText: string) => {
    if (!activeSessionId || isLoading) return;
    const truncated = messages.slice(0, index);
    const messagesToSend = [...truncated, { role: 'user' as const, content: newText }];
    await sendChatRequest(messagesToSend);
  }, [activeSessionId, isLoading, messages, sendChatRequest]);

  const deleteSpecificMessage = React.useCallback(async (index: number) => {
    if (!activeSessionId) return;
    const target = messages[index];
    setMessages((prev) => prev.filter((_, i) => i !== index));
    if (user && target?.id) {
      try { await deleteChatMessage(activeSessionId, target.id); } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        showError('Failed to delete message', message);
      }
    }
  }, [activeSessionId, messages, user, showError]);

  const clearActiveChat = React.useCallback(async () => {
    if (!activeSessionId) return;
    setMessages([{ role: 'assistant', content: 'Chat cleared. Ask a question to start over.' }]);
    if (user) {
      try { await clearChatMessages(activeSessionId); } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        showError('Failed to clear chat', message);
      }
    }
    showSuccess('Chat cleared', 'History was reset.');
  }, [activeSessionId, user, showError, showSuccess]);

  const openCitation = React.useCallback((citation: Citation) => {
    setSelectedCitation(citation);
    setIsDrawerOpen(true);
  }, []);

  const value = React.useMemo<ChatContextValue>(() => ({
    sessions, activeSession, messages, attachedDocs, documents, input, isLoading, isStreaming,
    selectedCitation, isDrawerOpen, isPreviewOpen,
    setInput, setIsPreviewOpen, setIsDrawerOpen, setSelectedCitation,
    createNewChat, selectChat, deleteChat, renameChat, attachDocument, uploadAndAttachDocument,
    handleSubmit, handleSendSuggestion, handleRegenerate, stopGeneration,
    handleInPlaceEdit, deleteSpecificMessage, clearActiveChat, openCitation,
  }), [
    sessions, activeSession, messages, attachedDocs, documents, input, isLoading, isStreaming,
    selectedCitation, isDrawerOpen, isPreviewOpen,
    createNewChat, selectChat, deleteChat, renameChat, attachDocument, uploadAndAttachDocument,
    handleSubmit, handleSendSuggestion, handleRegenerate, stopGeneration,
    handleInPlaceEdit, deleteSpecificMessage, clearActiveChat, openCitation,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const ctx = React.useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within a ChatProvider');
  return ctx;
}
