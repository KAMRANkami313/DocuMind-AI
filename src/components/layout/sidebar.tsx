'use client';

import { Check, FileText, LogIn, LogOut, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useChat } from '@/hooks/use-chat';
import { FileUpload } from '@/components/document/file-upload';
import type { DocumentMeta } from '@/types';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
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

  function handleUploadSuccess(doc: DocumentMeta) {
    addDocument(doc);
  }

  return (
    <aside
      className={cn(
        'flex w-80 shrink-0 flex-col justify-between border-r border-zinc-800 bg-zinc-900/60 p-5',
        className,
      )}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-indigo-600 p-2 shadow-lg shadow-indigo-600/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white">
                {APP_NAME}
              </h1>
              <p className="text-[10px] text-zinc-400">
                {user ? 'Cloud Workspace (Synced)' : 'Guest Sandbox (Local)'}
              </p>
            </div>
          </div>

          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              title="Sign out"
              className="cursor-pointer rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={openAuth}
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
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        switchDocument(doc);
                      }
                    }}
                    className={cn(
                      'group flex w-full cursor-pointer items-center justify-between rounded-lg border p-2.5 text-xs transition',
                      isSelected
                        ? 'border-indigo-500/50 bg-indigo-600/15 font-medium text-white'
                        : 'border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200',
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText
                        className={cn(
                          'h-4 w-4 shrink-0',
                          isSelected ? 'text-indigo-400' : 'text-zinc-500',
                        )}
                      />
                      <span className="truncate">{doc.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isSelected && (
                        <Check className="mr-1 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(doc.id, e)}
                        title="Delete document"
                        className="cursor-pointer p-1 text-zinc-500 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
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
          <FileUpload userId={user?.id} onUploadSuccess={handleUploadSuccess} />
        </div>
      </div>
    </aside>
  );
}