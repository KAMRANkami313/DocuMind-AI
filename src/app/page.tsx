'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  FileText,
  Sparkles,
  Check,
  Trash2,
  LogIn,
  LogOut,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { FileUpload } from '@/components/document/file-upload';
import { CitationDrawer } from '@/components/chat/citation-drawer';
import { MessageItem } from '@/components/chat/message-item';
import { AuthModal } from '@/components/auth/auth-modal';
import { PdfPreviewer } from '@/components/document/pdf-previewer';
import { useToast } from '@/hooks/use-toast';
import { type Citation } from '@/types';

interface DocumentMeta {
  id: string;
  name: string;
  blobUrl?: string;
}

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

export default function DocumentQAPage() {
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [activeDoc, setActiveDoc] = useState<DocumentMeta | null>(null);
  const [chatSessions, setChatSessions] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { error: showError, success: showSuccess } = useToast();

  // 1. Check user auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch cloud documents for logged in user
  const fetchCloudDocuments = useCallback(async (userId: string) => {
    const { data: userDocs } = await supabase
      .from('documents')
      .select('id, title, file_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (userDocs && userDocs.length > 0) {
      const formatted: DocumentMeta[] = userDocs.map((d: any) => ({
        id: d.id,
        name: d.file_name || d.title,
      }));
      setDocuments(formatted);
      setActiveDoc((prev) => (prev ? prev : (formatted[0] ?? null)));
    }
  }, []);

  // 3. Load cloud messages for active document
  useEffect(() => {
    async function loadCloudMessages() {
      if (!user || !activeDoc) return;

      const { data: cloudMessages } = await supabase
        .from('chat_messages')
        .select('id, role, content, citations')
        .eq('document_id', activeDoc.id)
        .order('created_at', { ascending: true });

      if (cloudMessages && cloudMessages.length > 0) {
        setChatSessions((prev) => ({
          ...prev,
          [activeDoc.id]: cloudMessages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            citations: m.citations || [],
          })),
        }));
      }
    }

    if (user && activeDoc) {
      loadCloudMessages();
    }
  }, [user, activeDoc]);

  // Auth state change handler
  useEffect(() => {
    if (user) {
      fetchCloudDocuments(user.id);
    } else {
      setDocuments([]);
      setActiveDoc(null);
      setChatSessions({});
    }
  }, [user, fetchCloudDocuments]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatSessions, activeDoc, isLoading]);

  const currentMessages: Message[] =
    (activeDoc && chatSessions[activeDoc.id]) ||
    (activeDoc
      ? [
          {
            role: 'assistant',
            content: `Loaded **${activeDoc.name}**. Ask any question, and I will answer with exact citations.`,
          },
        ]
      : [
          {
            role: 'assistant',
            content: user
              ? 'Welcome back! Upload a PDF to start analyzing across all your devices.'
              : 'Welcome to DocuMind AI (Guest Mode). Upload any PDF to start chatting instantly without an account.',
          },
        ]);

  function switchDocument(doc: DocumentMeta) {
    setActiveDoc(doc);
  }

  async function deleteDocument(docId: string, e: React.MouseEvent) {
    e.stopPropagation();

    const target = documents.find((d) => d.id === docId);
    const updatedDocs = documents.filter((d) => d.id !== docId);
    setDocuments(updatedDocs);

    const updatedChats = { ...chatSessions };
    delete updatedChats[docId];
    setChatSessions(updatedChats);

if (activeDoc?.id === docId) {
  setActiveDoc(updatedDocs.length > 0 ? (updatedDocs[0] ?? null) : null);
}

    if (user) {
      await supabase.from('documents').delete().eq('id', docId);
    }

    showSuccess('Document deleted', target ? `"${target.name}" was removed.` : undefined);
  }

  async function clearActiveChat() {
    if (!activeDoc) return;

    setChatSessions((prev) => ({
      ...prev,
      [activeDoc.id]: [
        {
          role: 'assistant',
          content: `Chat history cleared for **${activeDoc.name}**. Ask any question to start over.`,
        },
      ],
    }));

    if (user) {
      await supabase.from('chat_messages').delete().eq('document_id', activeDoc.id);
    }

    showSuccess('Chat cleared', `History for "${activeDoc.name}" was reset.`);
  }

  async function deleteSpecificMessage(index: number) {
    if (!activeDoc) return;
    const currentList = chatSessions[activeDoc.id] || [];
    const targetMsg = currentList[index];
    const updated = currentList.filter((_, idx) => idx !== index);

    setChatSessions((prev) => ({
      ...prev,
      [activeDoc.id]: updated,
    }));

    if (user && targetMsg?.id) {
      await supabase.from('chat_messages').delete().eq('id', targetMsg.id);
    }
  }

  async function handleInPlaceEdit(index: number, newText: string) {
    if (!activeDoc || isLoading) return;

    const currentList = chatSessions[activeDoc.id] || [];
    const truncated = currentList.slice(0, index);
    const editedUserMessage: Message = { role: 'user', content: newText };
    const messagesToSend = [...truncated, editedUserMessage];

    await sendChatRequest(messagesToSend);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!activeDoc) {
      showError('No document loaded', 'Upload a PDF to start chatting.');
      return;
    }

    const userMessage: Message = { role: 'user', content: input.trim() };
    const messagesToSend = [...currentMessages, userMessage];
    setInput('');

    await sendChatRequest(messagesToSend);
  }

  async function sendChatRequest(messagesToSend: Message[]) {
    if (!activeDoc) return;

    setChatSessions((prev) => ({
      ...prev,
      [activeDoc.id]: messagesToSend,
    }));

    setIsLoading(true);

// Save user message to cloud if logged in
    if (user) {
      const lastUser = messagesToSend[messagesToSend.length - 1];
      if (lastUser) {
        supabase
          .from('chat_messages')
          .insert({
            document_id: activeDoc.id,
            user_id: user.id,
            role: 'user',
            content: lastUser.content,
          })
          .then();
      }
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: activeDoc.id,
          messages: messagesToSend,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to retrieve response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let retrievedCitations: Citation[] = [];

      setChatSessions((prev) => ({
        ...prev,
        [activeDoc.id]: [...messagesToSend, { role: 'assistant', content: '', citations: [] }],
      }));

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const rawData = line.replace('data: ', '').trim();
            if (rawData === '[DONE]') break;

            try {
              const parsed = JSON.parse(rawData);
              if (parsed.citations) {
                retrievedCitations = parsed.citations.map((c: any) => ({
                  chunkId: c.content,
                  pageNumber: c.pageNumber,
                  excerpt: c.content,
                  similarity: c.similarity,
                }));
              }
              if (parsed.text) {
                assistantText += parsed.text;
                setChatSessions((prev) => {
                  const session = [...(prev[activeDoc.id] || [])];
                  const lastIndex = session.length - 1;
                  session[lastIndex] = {
                    role: 'assistant',
                    content: assistantText,
                    citations: retrievedCitations,
                  };
                  return { ...prev, [activeDoc.id]: session };
                });
              }
            } catch {
              // Ignore partial stream frames
            }
          }
        }
      }

      // Save assistant response to cloud if logged in
      if (user && assistantText) {
        supabase
          .from('chat_messages')
          .insert({
            document_id: activeDoc.id,
            user_id: user.id,
            role: 'assistant',
            content: assistantText,
            citations: retrievedCitations,
          })
          .then();
      }
    } catch (err: any) {
      showError('Failed to fetch response', err?.message ?? 'Unknown server error.');
      setChatSessions((prev) => ({
        ...prev,
        [activeDoc.id]: [
          ...messagesToSend,
          { role: 'assistant', content: `Error: ${err.message}` },
        ],
      }));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100 antialiased">
      {/* Sidebar */}
      <aside className="flex w-80 shrink-0 flex-col justify-between border-r border-zinc-800 bg-zinc-900/60 p-5">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-indigo-600 p-2 shadow-lg shadow-indigo-600/30">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white">DocuMind AI</h1>
                <p className="text-[10px] text-zinc-400">
                  {user ? 'Cloud Workspace (Synced)' : 'Guest Sandbox (Local)'}
                </p>
              </div>
            </div>

            {user ? (
              <button
                onClick={() => supabase.auth.signOut()}
                title="Sign out"
                className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-600/20 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 transition hover:bg-indigo-600/30"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </button>
            )}
          </div>

          <div>
            <div className="mb-2.5 flex items-center justify-between text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              <span>Your Documents</span>
              <span className="text-[10px] text-zinc-500">({documents.length})</span>
            </div>

            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {documents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-center text-xs text-zinc-500 italic">
                  No documents in cloud yet.
                </div>
              ) : (
                documents.map((doc) => {
                  const isSelected = activeDoc?.id === doc.id;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => switchDocument(doc)}
                      className={`group flex w-full cursor-pointer items-center justify-between rounded-lg border p-2.5 text-xs transition ${
                        isSelected
                          ? 'border-indigo-500/50 bg-indigo-600/15 font-medium text-white'
                          : 'border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText
                          className={`h-4 w-4 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-zinc-500'}`}
                        />
                        <span className="truncate">{doc.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isSelected && (
                          <Check className="mr-1 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                        )}
                        <button
                          onClick={(e) => deleteDocument(doc.id, e)}
                          title="Delete document"
                          className="cursor-pointer p-1 text-zinc-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              Upload PDF
            </div>
            <FileUpload
              userId={user?.id}
              onUploadSuccess={(newDoc) => {
                setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
                setActiveDoc(newDoc);
              }}
            />
          </div>
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <main className="relative flex flex-1 flex-col bg-zinc-950">
        {/* Top Navbar */}
        <header className="flex h-14 items-center justify-between border-b border-zinc-800/80 bg-zinc-900/20 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Active Document:</span>
            <span className="rounded-md border border-zinc-700/50 bg-zinc-800/80 px-2.5 py-1 font-medium text-zinc-200">
              {activeDoc ? activeDoc.name : 'None selected'}
            </span>
          </div>

          {activeDoc && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
              >
                <Eye className="h-3.5 w-3.5 text-indigo-400" />
                View Document
              </button>
              <button
                onClick={clearActiveChat}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-red-300"
                title="Clear current chat"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear Chat
              </button>
            </div>
          )}
        </header>

        {/* Messages Feed */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {currentMessages.map((msg, idx) => (
            <MessageItem
              key={idx}
              role={msg.role}
              content={msg.content}
              citations={msg.citations}
              onSelectCitation={(cite) => {
                setSelectedCitation(cite);
                setIsDrawerOpen(true);
              }}
              onSelectSuggestion={(suggestionText) => {
                setInput(suggestionText);
                setTimeout(() => {
                  const btn = document.querySelector(
                    'form button[type="submit"]',
                  ) as HTMLButtonElement;
                  btn?.click();
                }, 50);
              }}
              onSaveEdit={(newText) => handleInPlaceEdit(idx, newText)}
              onDeleteMessage={() => deleteSpecificMessage(idx)}
            />
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="border-t border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="mx-auto flex max-w-4xl gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                activeDoc
                  ? `Ask anything about ${activeDoc.name}...`
                  : 'Upload a PDF to start asking questions...'
              }
              disabled={isLoading || !activeDoc}
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-500 transition focus:border-indigo-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !activeDoc}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </main>

      {/* Slide-over Citation Drawer */}
      <CitationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        citation={selectedCitation}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(newUser) => setUser(newUser)}
      />

      {/* PDF Document Previewer Modal */}
      <PdfPreviewer
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        fileName={activeDoc ? activeDoc.name : ''}
        fileBlobUrl={activeDoc?.blobUrl}
      />
    </div>
  );
}
