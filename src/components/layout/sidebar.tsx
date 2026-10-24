'use client';

import * as React from 'react';
import {
  Check,
  FileText,
  LogIn,
  LogOut,
  Paperclip,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useChat } from '@/hooks/use-chat';
import { FileUpload } from '@/components/document/file-upload';
import type { DocumentMeta } from '@/types';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const { user, openAuth, signOut } = useAuth();
  const {
    documents,
    activeDoc,
    switchDocument,
    deleteDocument,
    addDocument,
    renameDocument,
    attachedDocIds,
    attachDocument,
  } = useChat();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const editRef = React.useRef<HTMLInputElement>(null);

  const filteredDocs = React.useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const q = searchQuery.toLowerCase();
    return documents.filter((d) => d.name.toLowerCase().includes(q));
  }, [documents, searchQuery]);

  React.useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  function handleDelete(docId: string, event: React.MouseEvent) {
    event.stopPropagation();
    void deleteDocument(docId);
  }

  function handleSelect(doc: DocumentMeta) {
    if (editingId === doc.id) return;
    switchDocument(doc);
    onNavigate?.();
  }

  function handleUploadSuccess(doc: DocumentMeta) {
    addDocument(doc);
    onNavigate?.();
  }

  function handleStartRename(doc: DocumentMeta, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(doc.id);
    setEditName(doc.name);
  }

  function handleSaveRename(docId: string) {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== documents.find((d) => d.id === docId)?.name) {
      void renameDocument(docId, trimmed);
    }
    setEditingId(null);
    setEditName('');
  }

  function handleCancelRename() {
    setEditingId(null);
    setEditName('');
  }

  function handleRenameKeyDown(e: React.KeyboardEvent, docId: string) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRename(docId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelRename();
    }
  }

  return (
    <aside
      className={cn(
        'flex w-80 shrink-0 flex-col border-r border-border bg-surface p-5',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-fg">
              {APP_NAME}
            </h1>
            <p className="text-[10px] text-fg-muted">
              {user ? 'Cloud Workspace' : 'Guest Mode'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              title="Sign out"
              className="cursor-pointer rounded-lg p-1.5 text-fg-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={openAuth}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/20 bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/15"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In
            </button>
          )}
          {onNavigate && (
            <button
              type="button"
              onClick={onNavigate}
              className="lg:hidden cursor-pointer rounded-lg p-1.5 text-fg-muted transition hover:bg-surface-2 hover:text-fg"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-2.5 flex items-center justify-between text-xs font-semibold tracking-wider text-fg-subtle uppercase">
          <span>Your Documents</span>
          <span className="text-[10px] text-fg-subtle">({documents.length})</span>
        </div>

        {documents.length > 0 && (
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-lg border border-border bg-surface-2 py-1.5 pl-8 pr-2 text-xs text-fg placeholder-fg-subtle focus:border-primary focus:outline-none"
            />
          </div>
        )}

        <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {documents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-fg-subtle italic">
              No documents yet.
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-fg-subtle italic">
              No matches for &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            filteredDocs.map((doc) => {
              const isSelected = activeDoc?.id === doc.id;
              const isEditing = editingId === doc.id;
              const canAttach =
                activeDoc &&
                doc.id !== activeDoc.id &&
                attachedDocIds.length < 2 &&
                !attachedDocIds.includes(doc.id);

              return (
                <div
                  key={doc.id}
                  onClick={() => handleSelect(doc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect(doc);
                    }
                  }}
                  className={cn(
                    'group flex w-full cursor-pointer items-center justify-between rounded-lg border p-2.5 text-xs transition',
                    isSelected
                      ? 'border-primary/30 bg-primary-soft font-medium text-fg'
                      : 'border-border bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg',
                    isEditing && 'cursor-default',
                  )}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                    <FileText
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isSelected ? 'text-primary' : 'text-fg-subtle',
                      )}
                    />
                    {isEditing ? (
                      <input
                        ref={editRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => handleRenameKeyDown(e, doc.id)}
                        onBlur={() => handleSaveRename(doc.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 rounded border border-primary bg-surface px-1.5 py-0.5 text-xs text-fg focus:outline-none"
                      />
                    ) : (
                      <span className="truncate">{doc.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected && !isEditing && (
                      <Check className="mr-1 h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveRename(doc.id);
                          }}
                          title="Save"
                          className="cursor-pointer p-1 text-primary transition hover:text-primary-hover"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelRename();
                          }}
                          title="Cancel"
                          className="cursor-pointer p-1 text-fg-subtle transition hover:text-danger"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        {canAttach && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              attachDocument(doc);
                            }}
                            title="Attach to current chat"
                            className="cursor-pointer p-1 text-fg-subtle opacity-0 transition hover:text-primary group-hover:opacity-100"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(doc, e)}
                          title="Rename"
                          className="cursor-pointer p-1 text-fg-subtle opacity-0 transition hover:text-primary group-hover:opacity-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(doc.id, e)}
                          title="Delete document"
                          className="cursor-pointer p-1 text-fg-subtle opacity-0 transition hover:text-danger group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold tracking-wider text-fg-subtle uppercase">
          Upload Document
        </div>
        <FileUpload userId={user?.id} onUploadSuccess={handleUploadSuccess} />
      </div>
    </aside>
  );
}