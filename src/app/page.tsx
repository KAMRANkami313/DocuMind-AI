'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, FileText, Sparkles, Check } from 'lucide-react';
import { FileUpload } from '@/components/document/file-upload';
import { CitationDrawer } from '@/components/chat/citation-drawer';
import { MessageItem } from '@/components/chat/message-item';
import { Citation } from '@/types';

interface DocumentMeta {
  id: string;
  name: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

const DEFAULT_DOCUMENTS: DocumentMeta[] = [
  { id: '31cdb084-9f77-4ebf-aecd-be8cf1293991', name: 'DL_Lab_02_Task.pdf' },
];

export default function DocumentQAPage() {
  const [documents, setDocuments] = useState<DocumentMeta[]>(DEFAULT_DOCUMENTS);
  const [activeDoc, setActiveDoc] = useState<DocumentMeta | null>(DEFAULT_DOCUMENTS[0]);
  
  // Persistent conversations mapped by document ID: { [docId]: Message[] }
  const [chatSessions, setChatSessions] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat histories from localStorage on initial render
  useEffect(() => {
    try {
      const savedChats = localStorage.getItem('documind_chat_sessions');
      if (savedChats) {
        setChatSessions(JSON.parse(savedChats));
      }
      const savedDocs = localStorage.getItem('documind_documents');
      if (savedDocs) {
        setDocuments(JSON.parse(savedDocs));
      }
    } catch {
      // Ignore initial SSR parse
    }
  }, []);

  // Save to localStorage whenever chat updates
  useEffect(() => {
    if (Object.keys(chatSessions).length > 0) {
      localStorage.setItem('documind_chat_sessions', JSON.stringify(chatSessions));
    }
  }, [chatSessions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatSessions, activeDoc, isLoading]);

  // Current active conversation
  const currentMessages: Message[] = (activeDoc && chatSessions[activeDoc.id]) || [
    {
      role: 'assistant',
      content: `Hello! I have loaded **${activeDoc ? activeDoc.name : 'your document'}**. Ask any question, and I will answer with exact citations.`,
    },
  ];

  function switchDocument(doc: DocumentMeta) {
    if (activeDoc?.id === doc.id) return; // Ignore clicking the already-active document
    setActiveDoc(doc);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!activeDoc) {
      alert('Please select or upload a document first.');
      return;
    }

    const userMessage: Message = { role: 'user', content: input.trim() };
    const updatedMessages = [...currentMessages, userMessage];

    // Optimistically update conversation
    setChatSessions((prev) => ({
      ...prev,
      [activeDoc.id]: updatedMessages,
    }));

    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: activeDoc.id,
          messages: updatedMessages,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to retrieve response from server');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let retrievedCitations: Citation[] = [];

      // Add temporary empty assistant message
      setChatSessions((prev) => ({
        ...prev,
        [activeDoc.id]: [...updatedMessages, { role: 'assistant', content: '', citations: [] }],
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
              // Ignore boundary chunks
            }
          }
        }
      }
    } catch (err: any) {
      setChatSessions((prev) => ({
        ...prev,
        [activeDoc.id]: [
          ...updatedMessages,
          { role: 'assistant', content: `Error: ${err.message}` },
        ],
      }));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans antialiased overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 border-r border-zinc-800 bg-zinc-900/60 p-5 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-600/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">DocuMind AI</h1>
              <p className="text-[11px] text-zinc-400">RAG Document Assistant</p>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
              Available Documents
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {documents.map((doc) => {
                const isSelected = activeDoc?.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => switchDocument(doc)}
                    className={`w-full text-left flex items-center justify-between p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500/50 text-white font-medium'
                        : 'bg-zinc-800/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-zinc-500'}`} />
                      <span className="truncate">{doc.name}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Upload Document
            </div>
            <FileUpload
              onUploadSuccess={(newDoc) => {
                setDocuments((prev) => {
                  const updated = [newDoc, ...prev.filter((d) => d.id !== newDoc.id)];
                  localStorage.setItem('documind_documents', JSON.stringify(updated));
                  return updated;
                });
                setActiveDoc(newDoc);
              }}
            />
          </div>
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <main className="flex-1 flex flex-col bg-zinc-950 relative">
        {/* Top Navbar */}
        <header className="h-14 border-b border-zinc-800/80 px-6 flex items-center justify-between bg-zinc-900/20 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Active Document:</span>
            <span className="font-medium text-zinc-200 bg-zinc-800/80 px-2.5 py-1 rounded-md border border-zinc-700/50">
              {activeDoc ? activeDoc.name : 'None selected'}
            </span>
          </div>
        </header>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                // Automatically send the suggested query
                const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                // Wait next tick for state to settle then submit
                setTimeout(() => {
                  const btn = document.querySelector('form button[type="submit"]') as HTMLButtonElement;
                  btn?.click();
                }, 50);
              }}
            />
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about the active document..."
              disabled={isLoading}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
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
    </div>
  );
}