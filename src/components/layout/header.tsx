'use client';

import { Eye, MoreVertical, RotateCcw, Download, X, FileText } from 'lucide-react';
import * as React from 'react';
import { useChat } from '@/hooks/use-chat';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { exportChat } from '@/lib/export';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onOpenPreview: () => void;
}

export function Header({ onOpenPreview }: HeaderProps) {
  const {
    activeDoc,
    clearActiveChat,
    currentMessages,
    attachedDocIds,
    attachedDocNames,
    detachDocument,
  } = useChat();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);

  const menuRef = React.useRef<HTMLDivElement>(null);
  const exportRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    if (menuOpen || exportOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [menuOpen, exportOpen]);

  function handleExport(format: 'markdown' | 'json') {
    setExportOpen(false);
    if (activeDoc && currentMessages.length > 0) {
      exportChat(currentMessages, activeDoc.name, format);
    }
  }

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface/60 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <span className="text-fg-subtle hidden sm:inline">Active Document:</span>
          <span className="truncate max-w-35 sm:max-w-xs rounded-md border border-border bg-surface-2 px-2.5 py-1 font-medium text-fg">
            {activeDoc ? activeDoc.name : 'None selected'}
          </span>
          {attachedDocIds.length > 0 && (
            <span className="text-[10px] text-fg-subtle font-medium">
              ({1 + attachedDocIds.length}/3)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {activeDoc && (
            <>
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenPreview}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-fg-muted transition hover:bg-surface-2 hover:text-fg"
                >
                  <Eye className="h-3.5 w-3.5 text-primary" />
                  View
                </button>
                <div className="relative" ref={exportRef}>
                  <button
                    type="button"
                    onClick={() => setExportOpen(!exportOpen)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-fg-muted transition hover:bg-surface-2 hover:text-fg"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </button>
                  {exportOpen && (
                    <div className="absolute right-0 top-10 z-50 w-36 rounded-lg border border-border bg-surface shadow-elevated py-1">
                      <button
                        type="button"
                        onClick={() => handleExport('markdown')}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
                      >
                        Markdown (.md)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExport('json')}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
                      >
                        JSON (.json)
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void clearActiveChat()}
                  title="Clear current chat"
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-fg-muted transition hover:bg-surface-2 hover:text-danger"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>

              <div className="sm:hidden relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex cursor-pointer items-center justify-center h-8 w-8 rounded-lg border border-border bg-surface text-fg-muted transition hover:bg-surface-2"
                  aria-label="More actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-10 z-50 w-44 rounded-lg border border-border bg-surface shadow-elevated py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenPreview();
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
                    >
                      <Eye className="h-3.5 w-3.5 text-primary" />
                      View Document
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handleExport('markdown');
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handleExport('json');
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        void clearActiveChat();
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-danger"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Clear Chat
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          <div className={cn('h-5 w-px bg-border', !activeDoc && 'hidden sm:block')} />
          <ThemeToggle />
        </div>
      </header>

      {attachedDocIds.length > 0 && (
        <div className="flex items-center gap-1.5 border-b border-border bg-surface/40 px-4 py-1.5 sm:px-6 overflow-x-auto">
          {attachedDocIds.map((docId) => {
            const name = attachedDocNames.get(docId) ?? 'Unknown';
            return (
              <span
                key={docId}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[10px] text-fg-muted"
              >
                <FileText className="h-3 w-3 text-primary shrink-0" />
                <span className="truncate max-w-32 font-medium">{name}</span>
                <button
                  type="button"
                  onClick={() => detachDocument(docId)}
                  className="cursor-pointer text-fg-subtle transition hover:text-danger ml-0.5"
                  aria-label={`Detach ${name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}