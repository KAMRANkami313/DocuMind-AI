'use client';

import * as React from 'react';
import { useAuthContext } from './auth-provider';
import { useToastContext } from './toast-provider';
import { supabase } from '@/lib/supabase/client';
import { streamChat } from '@/lib/api-client';
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
  currentMessages: ChatMessage[];
  selectedCitation: Citation | null;
  isDrawerOpen: boolean;
  isPreviewOpen: boolean;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  setActiveDoc: React.Dispatch<React.SetStateAction<DocumentMeta | null>>;
  setIsPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedCitation: React.Dispatch<React.SetStateAction<Citation | null>>;
  switchDocument: (doc: DocumentMeta) => void;
  addDocument: (doc: DocumentMeta) => void;
  deleteDocument: (docId: string) => Promise<void>;
  clearActiveChat: () => Promise<void>;
  deleteSpecificMessage: (index: number) => Promise<void>;
  handleInPlaceEdit: (index: number, newText: string) => Promise<void>;
  handleSendSuggestion: (suggestion: string) => Promise<void>;
  handleSubmit: () => Promise<void>;
  openCitation: (citation: Citation) => void;
}

const ChatContext = React.createContext<ChatContextValue | null>(null);

interface DocumentRow {
  id: string;
  file_name: string | null;
  title: string | null;
}

interface ChatMessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[] | null;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const { error: showError, success: showSuccess } = useToastContext();

  const [documents, setDocuments] = React.useState<DocumentMeta[]>([]);
  const [activeDoc, setActiveDoc] = React.useState<DocumentMeta | null>(null);
  const [chatSessions, setChatSessions] = React.useState<ChatSessions>({});
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [selectedCitation, setSelectedCitation] = React.useState<Citation | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    async function loadCloudDocuments() {
      if (!user) return;
      const { data: userDocs } = await supabase
        .from('documents')
        .select('id, title, file_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!active || !userDocs || userDocs.length === 0) return;
      const typed = userDocs as DocumentRow[];
      const formatted: DocumentMeta[] = typed.map((d) => ({
        id: d.id,
        name: d.file_name ?? d.title ?? 'Untitled',
      }));
      setDocuments(formatted);
      setActiveDoc((prev) => (prev ? prev : (formatted[0] ?? null)));
    }
    if (user) {
      void loadCloudDocuments();
    } else {
      setDocuments([]);
      setActiveDoc(null);
      setChatSessions({});
    }
    return () => {
      active = false;
    };
  }, [user]);

  React.useEffect(() => {
    let active = true;
    async function loadCloudMessages() {
      if (!user || !activeDoc) return;
      const { data: cloudMessages } = await supabase
        .from('chat_messages')
        .select('id, role, content, citations')
        .eq('document_id', activeDoc.id)
        .order('created_at', { ascending: true });
      if (!active || !cloudMessages || cloudMessages.length === 0) return;
      const typed = cloudMessages as ChatMessageRow[];
      setChatSessions((prev) => ({
        ...prev,
        [activeDoc.id]: typed.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: m.citations ?? [],
        })),
      }));
    }
    if (user && activeDoc) {
      void loadCloudMessages();
    }
    return () => {
      active = false;
    };
  }, [user, activeDoc]);

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
        content: user
          ? 'Welcome back! Upload a PDF to start analyzing across all your devices.'
          : 'Welcome to DocuMind AI (Guest Mode). Upload any PDF to start chatting instantly without an account.',
      },
    ];
  }, [activeDoc, chatSessions, user]);

  const sendChatRequest = React.useCallback(
    async (messagesToSend: ChatMessage[]) => {
      if (!activeDoc) return;
      const activeDocId = activeDoc.id;

      setChatSessions((prev) => ({ ...prev, [activeDocId]: messagesToSend }));
      setIsLoading(true);

      if (user) {
        const lastUser = messagesToSend[messagesToSend.length - 1];
        if (lastUser) {
          void supabase.from('chat_messages').insert({
            document_id: activeDocId,
            user_id: user.id,
            role: 'user',
            content: lastUser.content,
          });
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
          messages: messagesToSend,
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

        if (user && assistantText) {
          void supabase.from('chat_messages').insert({
            document_id: activeDocId,
            user_id: user.id,
            role: 'assistant',
            content: assistantText,
            citations: retrievedCitations,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown server error';
        showError('Failed to fetch response', message);
        setChatSessions((prev) => ({
          ...prev,
          [activeDocId]: [
            ...messagesToSend,
            { role: 'assistant', content: `Error: ${message}` },
          ],
        }));
      } finally {
        setIsLoading(false);
      }
    },
    [activeDoc, user, showError],
  );

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

  const switchDocument = React.useCallback((doc: DocumentMeta) => {
    setActiveDoc(doc);
  }, []);

  const addDocument = React.useCallback((doc: DocumentMeta) => {
    setDocuments((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]);
    setActiveDoc(doc);
  }, []);

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
      if (activeDoc?.id === docId) {
        setActiveDoc(updatedDocs.length > 0 ? (updatedDocs[0] ?? null) : null);
      }
      if (user) {
        await supabase.from('documents').delete().eq('id', docId);
      }
      showSuccess(
        'Document deleted',
        target ? `"${target.name}" was removed.` : undefined,
      );
    },
    [documents, activeDoc, user, showSuccess],
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
    if (user) {
      await supabase.from('chat_messages').delete().eq('document_id', docId);
    }
    showSuccess('Chat cleared', `History for "${docName}" was reset.`);
  }, [activeDoc, user, showSuccess]);

  const deleteSpecificMessage = React.useCallback(
    async (index: number) => {
      if (!activeDoc) return;
      const docId = activeDoc.id;
      const currentList = chatSessions[docId] ?? [];
      const targetMsg = currentList[index];
      const updated = currentList.filter((_, idx) => idx !== index);
      setChatSessions((prev) => ({ ...prev, [docId]: updated }));
      if (user && targetMsg?.id) {
        await supabase.from('chat_messages').delete().eq('id', targetMsg.id);
      }
    },
    [activeDoc, chatSessions, user],
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
      currentMessages,
      selectedCitation,
      isDrawerOpen,
      isPreviewOpen,
      setInput,
      setActiveDoc,
      setIsPreviewOpen,
      setIsDrawerOpen,
      setSelectedCitation,
      switchDocument,
      addDocument,
      deleteDocument,
      clearActiveChat,
      deleteSpecificMessage,
      handleInPlaceEdit,
      handleSendSuggestion,
      handleSubmit,
      openCitation,
    }),
    [
      documents,
      activeDoc,
      chatSessions,
      input,
      isLoading,
      currentMessages,
      selectedCitation,
      isDrawerOpen,
      isPreviewOpen,
      switchDocument,
      addDocument,
      deleteDocument,
      clearActiveChat,
      deleteSpecificMessage,
      handleInPlaceEdit,
      handleSendSuggestion,
      handleSubmit,
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