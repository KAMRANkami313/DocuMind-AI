'use client';

import * as React from 'react';
import { LogIn, LogOut, MessageSquare, MoreVertical, Pencil, Plus, Search, Sparkles, Trash2, X, PanelLeftClose, PanelLeft, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useChat } from '@/hooks/use-chat';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { DocumentMeta } from '@/types';

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
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

export function Sidebar({ className, onNavigate, onToggleCollapse, isCollapsed }: SidebarProps) {
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
    isStreaming,
  } = useChat();

  const [menuSessionId, setMenuSessionId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showLibrary, setShowLibrary] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const editRef = React.useRef<HTMLInputElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuSessionId(null);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    if (menuSessionId || profileOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [menuSessionId, profileOpen]);

  React.useEffect(() => {
    if (editingId && editRef.current) { editRef.current.focus(); editRef.current.select(); }
  }, [editingId]);

  const filteredSessions = React.useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q) || s.preview?.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

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
          {onToggleCollapse && (
            <button onClick={onToggleCollapse} className="hidden lg:flex cursor-pointer rounded-lg p-1.5 text-fg-muted transition hover:bg-surface-2 hover:text-fg" aria-label="Toggle sidebar" title="Toggle sidebar">
              {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
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

      {sessions.length > 0 && (
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full rounded-lg border border-border bg-surface-2 py-1.5 pl-8 pr-2 text-xs text-fg placeholder-fg-subtle focus:border-primary focus:outline-none"
          />
        </div>
      )}

      <div className="mb-2 text-[10px] font-semibold tracking-wider text-fg-subtle uppercase">Recents</div>
      <div className="flex-1 space-y-1 overflow-y-auto pr-1">
        {filteredSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-fg-subtle italic">
            {searchQuery ? 'No chats match your search.' : 'No chats yet.'}
          </div>
        ) : (
          filteredSessions.map((sess) => {
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
          <span>Library ({documents.length})</span>
          <ChevronDown className={cn('h-3 w-3 transition-transform', showLibrary && 'rotate-180')} />
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

      <div className="mt-3 border-t border-border pt-3">
        {user ? (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left transition hover:bg-surface-2"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-fg">{user.email}</p>
                <p className="text-[10px] text-fg-subtle">Free Plan</p>
              </div>
              <ChevronDown className="h-3 w-3 text-fg-subtle" />
            </button>
            {profileOpen && (
              <div className="absolute bottom-12 left-0 right-0 z-50 rounded-lg border border-border bg-surface shadow-elevated py-1">
                <div className="px-3 py-1.5 text-[10px] text-fg-subtle">Signed in as</div>
                <div className="px-3 pb-2 text-xs font-medium text-fg truncate">{user.email}</div>
                <div className="border-t border-border" />
                <button onClick={() => void signOut()} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-danger">
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={openAuth} className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-primary/20 bg-primary-soft px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15">
            <LogIn className="h-3.5 w-3.5" /> Sign In
          </button>
        )}
      </div>
    </aside>
  );
}