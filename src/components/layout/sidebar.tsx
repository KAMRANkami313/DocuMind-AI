'use client';

import { Check, FileText, LogIn, LogOut, Sparkles, Trash2, X } from 'lucide-react';
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
  } = useChat();

  function handleDelete(docId: string, event: React.MouseEvent) {
    event.stopPropagation();
    void deleteDocument(docId);
  }

  function handleSelect(doc: DocumentMeta) {
    switchDocument(doc);
    onNavigate?.();
  }

  function handleUploadSuccess(doc: DocumentMeta) {
    addDocument(doc);
    onNavigate?.();
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

        <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {documents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-fg-subtle italic">
              No documents yet.
            </div>
          ) : (
            documents.map((doc) => {
              const isSelected = activeDoc?.id === doc.id;
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
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isSelected ? 'text-primary' : 'text-fg-subtle',
                      )}
                    />
                    <span className="truncate">{doc.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isSelected && (
                      <Check className="mr-1 h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(doc.id, e)}
                      title="Delete document"
                      className="cursor-pointer p-1 text-fg-subtle opacity-0 transition hover:text-danger group-hover:opacity-100"
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
        <div className="mb-2 text-xs font-semibold tracking-wider text-fg-subtle uppercase">
          Upload PDF
        </div>
        <FileUpload userId={user?.id} onUploadSuccess={handleUploadSuccess} />
      </div>
    </aside>
  );
}