'use client';

import * as React from 'react';
import { useAuthContext } from './auth-provider';
import { useToastContext } from './toast-provider';
import { supabase } from '@/lib/supabase/client';
import {
  streamChat,
  insertChatMessage,
  loadChatMessages,
  deleteChatMessage,
  clearChatMessages,
  renameDocument as apiRenameDocument,
} from '@/lib/api-client';
import type {
  ChatMessage,
  ChatSessions,
  Citation,
  DocumentMeta,
} from '@/types';

interface ChatContextValue {
  documents: DocumentMeta[];
  activeDoc: DocumentMeta | null;
  chatSessions: ChatSessions;
  input: string;
  isLoading: boolean;
  isStreaming: boolean;
  currentMessages: ChatMessage[];
  selectedCitation: Citation | null;
  isDrawerOpen: boolean;
  isPreviewOpen: boolean;
  attachedDocIds: string[];
  attachedDocNames: Map<string, string>;
  attachDocument: (doc: DocumentMeta) => void;
  detachDocument: (docId: string) => void;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setActiveDoc: React.Dispatch<React.SetStateAction<DocumentMeta | null>>;
  setIsPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedCitation: React.Dispatch<React.SetStateAction<Citation | null>>;
  switchDocument: (doc: DocumentMeta) => void;
  addDocument: (doc: DocumentMeta) => void;
  renameDocument: (docId: string, newName: string) => Promise<void>;
  deleteDocument: (docId: string) => Promise<void>;
  clearActiveChat: () => Promise<void>;
  deleteSpecificMessage: (index: number) => Promise<void>;
  handleInPlaceEdit: (index: number, newText: string) => Promise<void>;
  handleSendSuggestion: (suggestion: string) => Promise<void>;
  handleSubmit: () => Promise<void>;
  handleRegenerate: () => Promise<void>;
  stopGeneration: () => void;
  openCitation: (citation: Citation) => void;
}

const ChatContext = React.createContext<ChatContextValue | null>(null);

interface DocumentRow {
  id: string;
  file_name: string | null;
  title: string | null;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const { error: showError, success: showSuccess } = useToastContext();

  const [documents, setDocuments] = React.useState<DocumentMeta[]>([]);
  const [activeDoc, setActiveDoc] = React.useState<DocumentMeta | null>(null);
  const [chatSessions, setChatSessions] = React.useState<ChatSessions>({});
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [selectedCitation, setSelectedCitation] = React.useState<Citation | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [attachedDocIds, setAttachedDocIds] = React.useState<string[]>([]);
  const [attachedDocNames, setAttachedDocNames] = React.useState<Map<string, string>>(new Map());

  const abortControllerRef = React.useRef<AbortController | null>(null);
  const loadedDocsRef = React.useRef<Set<string>>(new Set());
  const loadedMessagesRef = React.useRef<Set<string>>(new Set());

  const userId = user?.id;

  React.useEffect(() => {
    let active = true;
    async function loadCloudDocuments() {
      if (!userId) return;
      if (loadedDocsRef.current.has(userId)) return;
      loadedDocsRef.current.add(userId);

      const { data: userDocs } = await supabase
        .from('documents')
        .select('id, title, file_name')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!active) return;
      if (!userDocs || userDocs.length === 0) return;

      const formatted: DocumentMeta[] = (userDocs as DocumentRow[]).map((d) => ({
        id: d.id,
        name: d.file_name ?? d.title ?? 'Untitled',
      }));
      setDocuments(formatted);
      setActiveDoc((prev) => (prev ? prev : (formatted[0] ?? null)));
    }
    if (userId) {
      void loadCloudDocuments();
    } else {
      loadedDocsRef.current.clear();
      loadedMessagesRef.current.clear();
      setDocuments([]);
      setActiveDoc(null);
      setChatSessions({});
      setAttachedDocIds([]);
      setAttachedDocNames(new Map());
    }
    return () => {
      active = false;
    };
  }, [userId]);

  React.useEffect(() => {
    let active = true;
    async function loadCloudMessages() {
      if (!userId || !activeDoc) return;
      if (loadedMessagesRef.current.has(activeDoc.id)) return;
      loadedMessagesRef.current.add(activeDoc.id);

      try {
        const messages = await loadChatMessages(activeDoc.id);
        if (!active || messages.length === 0) return;
        setChatSessions((prev) => ({
          ...prev,
          [activeDoc.id]: messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            citations: m.citations ?? [],
          })),
        }));
      } catch (err) {
        loadedMessagesRef.current.delete(activeDoc.id);
        const message = err instanceof Error ? err.message : 'Failed to load chat';
        showError('Could not load chat history', message);
      }
    }
    if (userId && activeDoc) {
      void loadCloudMessages();
    }
    return () => {
      active = false;
    };
  }, [userId, activeDoc, showError]);

  const currentMessages = React.useMemo<ChatMessage[]>(() => {
    if (activeDoc) {
      const session = chatSessions[activeDoc.id];
      if (session) return session;
      return [
        {
          role: 'assistant',
          content: `Loaded **${activeDoc.name}**. Ask any question, and I will answer with exact citations.`,
        },
      ];
    }
    return [
      {
        role: 'assistant',
        content: userId
          ? 'Welcome back! Upload a PDF to start analyzing across all your devices.'
          : 'Welcome to DocuMind AI (Guest Mode). Upload any PDF to start chatting instantly without an account.',
      },
    ];
  }, [activeDoc, chatSessions, userId]);

  const sendChatRequest = React.useCallback(
    async (messagesToSend: ChatMessage[]) => {
      if (!activeDoc) return;
      const activeDocId = activeDoc.id;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setChatSessions((prev) => ({ ...prev, [activeDocId]: messagesToSend }));
      setIsLoading(true);
      setIsStreaming(true);

      const lastUser = messagesToSend[messagesToSend.length - 1];
      if (userId && lastUser) {
        try {
          await insertChatMessage({
            documentId: activeDocId,
            role: 'user',
            content: lastUser.content,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          showError('Failed to save your message', message);
        }
      }

      let assistantText = '';
      let retrievedCitations: Citation[] = [];

      setChatSessions((prev) => ({
        ...prev,
        [activeDocId]: [
          ...messagesToSend,
          { role: 'assistant', content: '', citations: [] },
        ],
      }));

      try {
        await streamChat({
          documentId: activeDocId,
          documentIds: attachedDocIds.length > 0 ? [activeDocId, ...attachedDocIds] : undefined,
          messages: messagesToSend,
          signal: abortController.signal,
          onCitations: (citations) => {
            retrievedCitations = citations;
          },
          onText: (text) => {
            assistantText += text;
            setChatSessions((prev) => {
              const session = [...(prev[activeDocId] ?? [])];
              const lastIndex = session.length - 1;
              const last = session[lastIndex];
              if (!last) return prev;
              session[lastIndex] = {
                role: 'assistant',
                content: assistantText,
                citations: retrievedCitations,
              };
              return { ...prev, [activeDocId]: session };
            });
          },
        });

        if (userId && assistantText) {
          try {
            await insertChatMessage({
              documentId: activeDocId,
              role: 'assistant',
              content: assistantText,
              citations: retrievedCitations,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            showError('Failed to save assistant response', message);
          }
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          if (userId && assistantText) {
            try {
              await insertChatMessage({
                documentId: activeDocId,
                role: 'assistant',
                content: assistantText + '\n\n_⏹ Generation stopped_',
                citations: retrievedCitations,
              });
            } catch {
              // Best-effort save of partial response
            }
          }
        } else {
          const message = err instanceof Error ? err.message : 'Unknown server error';
          showError('Failed to fetch response', message);
          setChatSessions((prev) => ({
            ...prev,
            [activeDocId]: [
              ...messagesToSend,
              { role: 'assistant', content: `Error: ${message}` },
            ],
          }));
        }
      } finally {
        abortControllerRef.current = null;
        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    [activeDoc, userId, showError, attachedDocIds],
  );

  const stopGeneration = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const handleSubmit = React.useCallback(async () => {
    if (!input.trim() || isLoading) return;
    if (!activeDoc) {
      showError('No document loaded', 'Upload a PDF to start chatting.');
      return;
    }
    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const messagesToSend = [...currentMessages, userMessage];
    setInput('');
    await sendChatRequest(messagesToSend);
  }, [input, isLoading, activeDoc, currentMessages, sendChatRequest, showError, setInput]);

  const handleSendSuggestion = React.useCallback(
    async (suggestion: string) => {
      if (!suggestion.trim() || isLoading || !activeDoc) return;
      const userMessage: ChatMessage = { role: 'user', content: suggestion.trim() };
      const messagesToSend = [...currentMessages, userMessage];
      await sendChatRequest(messagesToSend);
    },
    [isLoading, activeDoc, currentMessages, sendChatRequest],
  );

  const handleRegenerate = React.useCallback(async () => {
    if (!activeDoc || isLoading) return;
    const docId = activeDoc.id;
    const session = chatSessions[docId] ?? [];
    if (session.length < 2) return;

    const lastAssistantIdx = session.length - 1;
    const lastAssistant = session[lastAssistantIdx];
    if (!lastAssistant || lastAssistant.role !== 'assistant') return;

    let lastUserIdx = lastAssistantIdx - 1;
    while (lastUserIdx >= 0 && session[lastUserIdx]?.role !== 'user') {
      lastUserIdx -= 1;
    }
    if (lastUserIdx < 0) return;
    const lastUser = session[lastUserIdx];
    if (!lastUser) return;

    const truncated = session.slice(0, lastUserIdx);
    const messagesToSend = [...truncated, { role: 'user' as const, content: lastUser.content }];

    if (lastAssistant.id) {
      try {
        await deleteChatMessage(docId, lastAssistant.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        showError('Failed to regenerate', message);
        return;
      }
    }

    await sendChatRequest(messagesToSend);
  }, [activeDoc, isLoading, chatSessions, sendChatRequest, showError]);

  const switchDocument = React.useCallback((doc: DocumentMeta) => {
    setActiveDoc(doc);
    setAttachedDocIds([]);
    setAttachedDocNames(new Map());
  }, []);

  const attachDocument = React.useCallback((doc: DocumentMeta) => {
    setAttachedDocIds((prev) => {
      if (prev.includes(doc.id)) return prev;
      if (prev.length >= 2) return prev;
      return [...prev, doc.id];
    });
    setAttachedDocNames((prev) => {
      const next = new Map(prev);
      next.set(doc.id, doc.name);
      return next;
    });
  }, []);

  const detachDocument = React.useCallback((docId: string) => {
    setAttachedDocIds((prev) => prev.filter((id) => id !== docId));
    setAttachedDocNames((prev) => {
      const next = new Map(prev);
      next.delete(docId);
      return next;
    });
  }, []);

  const addDocument = React.useCallback((doc: DocumentMeta) => {
    setDocuments((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]);
    loadedMessagesRef.current.add(doc.id);
    setActiveDoc(doc);
  }, []);

  const renameDocument = React.useCallback(
    async (docId: string, newName: string) => {
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, name: newName } : d)),
      );
      if (activeDoc?.id === docId) {
        setActiveDoc((prev) => (prev ? { ...prev, name: newName } : prev));
      }
      try {
        await apiRenameDocument(docId, newName);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        showError('Failed to rename document', message);
      }
    },
    [activeDoc, showError],
  );

  const deleteDocument = React.useCallback(
    async (docId: string) => {
      const target = documents.find((d) => d.id === docId);
      const updatedDocs = documents.filter((d) => d.id !== docId);
      setDocuments(updatedDocs);
      setChatSessions((prev) => {
        const next = { ...prev };
        delete next[docId];
        return next;
      });
      loadedMessagesRef.current.delete(docId);
      if (activeDoc?.id === docId) {
        setActiveDoc(updatedDocs.length > 0 ? (updatedDocs[0] ?? null) : null);
      }
      if (userId) {
        await supabase.from('documents').delete().eq('id', docId);
      }
      showSuccess(
        'Document deleted',
        target ? `"${target.name}" was removed.` : undefined,
      );
    },
    [documents, activeDoc, userId, showSuccess],
  );

  const clearActiveChat = React.useCallback(async () => {
    if (!activeDoc) return;
    const docId = activeDoc.id;
    const docName = activeDoc.name;
    setChatSessions((prev) => ({
      ...prev,
      [docId]: [
        {
          role: 'assistant',
          content: `Chat history cleared for **${docName}**. Ask any question to start over.`,
        },
      ],
    }));
    if (userId) {
      try {
        await clearChatMessages(docId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        showError('Failed to clear chat history', message);
      }
    }
    showSuccess('Chat cleared', `History for "${docName}" was reset.`);
  }, [activeDoc, userId, showSuccess, showError]);

  const deleteSpecificMessage = React.useCallback(
    async (index: number) => {
      if (!activeDoc) return;
      const docId = activeDoc.id;
      const currentList = chatSessions[docId] ?? [];
      const targetMsg = currentList[index];
      const updated = currentList.filter((_, idx) => idx !== index);
      setChatSessions((prev) => ({ ...prev, [docId]: updated }));
      if (userId && targetMsg?.id) {
        try {
          await deleteChatMessage(docId, targetMsg.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          showError('Failed to delete message', message);
        }
      }
    },
    [activeDoc, chatSessions, userId, showError],
  );

  const handleInPlaceEdit = React.useCallback(
    async (index: number, newText: string) => {
      if (!activeDoc || isLoading) return;
      const docId = activeDoc.id;
      const currentList = chatSessions[docId] ?? [];
      const truncated = currentList.slice(0, index);
      const editedUserMessage: ChatMessage = { role: 'user', content: newText };
      const messagesToSend = [...truncated, editedUserMessage];
      await sendChatRequest(messagesToSend);
    },
    [activeDoc, isLoading, chatSessions, sendChatRequest],
  );

  const openCitation = React.useCallback((citation: Citation) => {
    setSelectedCitation(citation);
    setIsDrawerOpen(true);
  }, []);

  const value = React.useMemo<ChatContextValue>(
    () => ({
      documents,
      activeDoc,
      chatSessions,
      input,
      isLoading,
      isStreaming,
      currentMessages,
      selectedCitation,
      isDrawerOpen,
      isPreviewOpen,
      attachedDocIds,
      attachedDocNames,
      attachDocument,
      detachDocument,
      setInput,
      setActiveDoc,
      setIsPreviewOpen,
      setIsDrawerOpen,
      setSelectedCitation,
      switchDocument,
      addDocument,
      renameDocument,
      deleteDocument,
      clearActiveChat,
      deleteSpecificMessage,
      handleInPlaceEdit,
      handleSendSuggestion,
      handleSubmit,
      handleRegenerate,
      stopGeneration,
      openCitation,
    }),
    [
      documents,
      activeDoc,
      chatSessions,
      input,
      isLoading,
      isStreaming,
      currentMessages,
      selectedCitation,
      isDrawerOpen,
      isPreviewOpen,
      attachedDocIds,
      attachedDocNames,
      attachDocument,
      detachDocument,
      switchDocument,
      addDocument,
      renameDocument,
      deleteDocument,
      clearActiveChat,
      deleteSpecificMessage,
      handleInPlaceEdit,
      handleSendSuggestion,
      handleSubmit,
      handleRegenerate,
      stopGeneration,
      openCitation,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const ctx = React.useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return ctx;
}
