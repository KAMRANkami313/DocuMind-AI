'use client';

import * as React from 'react';
import { Check, FileText, LogIn, LogOut, MessageSquare, MoreVertical, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useChat } from '@/hooks/use-chat';
import { FileUpload } from '@/components/document/file-upload';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { DocumentMeta } from '@/types';

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const { user, openAuth, signOut } = useAuth(); 
  const {
    sessions,
    activeSession,
    createNewChat,
    selectChat,
    deleteChat,
    renameChat,
    documents,
    attachDocument,
    uploadAndAttachDocument,
    isStreaming,
  } = useChat();

  const [menuSessionId, setMenuSessionId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [showLibrary, setShowLibrary] = React.useState(false);
  const editRef = React.useRef<HTMLInputElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuSessionId(null);
    }
    if (menuSessionId) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [menuSessionId]);

  React.useEffect(() => {
    if (editingId && editRef.current) { editRef.current.focus(); editRef.current.select(); }
  }, [editingId]);

  function handleNewChat() {
    void createNewChat();
    onNavigate?.();
  }

  function handleSelect(sessionId: string) {
    if (editingId === sessionId) return;
    selectChat(sessionId);
    onNavigate?.();
  }

  function handleStartRename(sessionId: string, title: string, e: React.MouseEvent) {
    e.stopPropagation();
    setMenuSessionId(null);
    setEditingId(sessionId);
    setEditTitle(title);
  }

  function handleSaveRename(sessionId: string) {
    const trimmed = editTitle.trim();
    if (trimmed) void renameChat(sessionId, trimmed);
    setEditingId(null);
  }

  function handleDelete(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setMenuSessionId(null);
    void deleteChat(sessionId);
  }

  function handleAttach(doc: DocumentMeta, e: React.MouseEvent) {
    e.stopPropagation();
    void attachDocument(doc.id, doc.name);
  }

  return (
    <aside className={cn('flex w-72 shrink-0 flex-col border-r border-border bg-surface p-3', className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-1.5 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold text-fg">{APP_NAME}</span>
        </div>
        <div className="flex items-center gap-1">
          {user ? (
            <button onClick={() => void signOut()} title="Sign out" className="cursor-pointer rounded-lg p-1.5 text-fg-muted transition hover:bg-surface-2 hover:text-fg">
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={openAuth} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/20 bg-primary-soft px-2 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/15">
              <LogIn className="h-3 w-3" /> Sign In
            </button>
          )}
          {onNavigate && (
            <button onClick={onNavigate} className="lg:hidden cursor-pointer rounded-lg p-1.5 text-fg-muted transition hover:bg-surface-2 hover:text-fg" aria-label="Close sidebar">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <button
        onClick={handleNewChat}
        disabled={isStreaming}
        className="mb-3 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" /> New Chat
      </button>

      <div className="mb-2 text-[10px] font-semibold tracking-wider text-fg-subtle uppercase">Recents</div>
      <div className="flex-1 space-y-1 overflow-y-auto pr-1">
        {sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-fg-subtle italic">No chats yet.</div>
        ) : (
          sessions.map((sess) => {
            const isActive = activeSession?.id === sess.id;
            const isEditing = editingId === sess.id;
            return (
              <div key={sess.id} className="relative">
                <div
                  onClick={() => handleSelect(sess.id)}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(sess.id); } }}
                  className={cn('group flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-xs transition',
                    isActive ? 'border-primary/30 bg-primary-soft text-fg' : 'border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg')}
                >
                  <MessageSquare className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', isActive ? 'text-primary' : 'text-fg-subtle')} />
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <input
                        ref={editRef} type="text" value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveRename(sess.id); } else if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); } }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded border border-primary bg-surface px-1.5 py-0.5 text-xs text-fg focus:outline-none"
                      />
                    ) : (
                      <>
                        <p className="truncate font-medium">{sess.title}</p>
                        {sess.preview && <p className="truncate text-[10px] text-fg-subtle">{sess.preview}</p>}
                        <p className="mt-0.5 text-[10px] text-fg-subtle">{formatRelativeTime(sess.updatedAt)}</p>
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuSessionId(menuSessionId === sess.id ? null : sess.id); }}
                      className="cursor-pointer rounded p-0.5 text-fg-subtle opacity-0 transition hover:text-fg group-hover:opacity-100"
                      aria-label="More options"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {menuSessionId === sess.id && (
                  <div ref={menuRef} className="absolute right-2 top-10 z-50 w-32 rounded-lg border border-border bg-surface shadow-elevated py-1">
                    <button onClick={(e) => handleStartRename(sess.id, sess.title, e)} className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg">
                      <Pencil className="h-3 w-3" /> Rename
                    </button>
                    <button onClick={(e) => handleDelete(sess.id, e)} className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-fg-muted hover:bg-surface-2 hover:text-danger">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <button
          onClick={() => setShowLibrary(!showLibrary)}
          className="mb-2 flex w-full cursor-pointer items-center justify-between text-[10px] font-semibold tracking-wider text-fg-subtle uppercase"
        >
          <span>Document Library ({documents.length})</span>
        </button>
        {showLibrary && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {documents.length === 0 ? (
              <p className="text-[10px] text-fg-subtle italic p-2">No documents uploaded.</p>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="group flex items-center justify-between rounded px-2 py-1 text-[10px] text-fg-muted hover:bg-surface-2">
                  <span className="truncate">{doc.name}</span>
                  {activeSession && (
                    <button onClick={(e) => handleAttach(doc, e)} className="cursor-pointer text-primary opacity-0 group-hover:opacity-100" title="Attach to current chat">
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
}