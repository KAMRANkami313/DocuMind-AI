'use client';

import { Eye, MoreVertical, RotateCcw, Download, FileText, Menu } from 'lucide-react';
import * as React from 'react';
import { useChat } from '@/hooks/use-chat';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { exportChat } from '@/lib/export';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onOpenPreview: () => void;
  onOpenMobileSidebar: () => void;
}

export function Header({ onOpenPreview, onOpenMobileSidebar }: HeaderProps) {
  const { activeSession, clearActiveChat, messages, attachedDocs } = useChat();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const exportRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    }
    if (menuOpen || exportOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [menuOpen, exportOpen]);

  function handleExport(format: 'markdown' | 'json') {
    setExportOpen(false);
    if (activeSession && messages.length > 0) {
      exportChat(messages, activeSession.title, format);
    }
  }

  return (
    <>
      {/* relative + z-30 establishes a stacking context that sits above the
          chat message feed and citation bubbles, so the dropdowns inside
          (which use z-50) always paint above chat content. */}
      <header className="relative z-30 flex h-14 items-center justify-between border-b border-border bg-surface/80 px-3 backdrop-blur-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden cursor-pointer rounded-lg p-1.5 text-fg-muted transition hover:bg-surface-2 hover:text-fg"
            aria-label="Open sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="truncate max-w-32 rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg sm:max-w-xs">
            {activeSession ? activeSession.title : 'New Chat'}
          </span>
          {attachedDocs.length > 0 && (
            <span className="hidden text-[10px] text-fg-subtle sm:inline">
              ({attachedDocs.length}/3 docs)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {activeSession && (
            <>
              {/* Desktop action buttons (>= sm) */}
              <div className="hidden sm:flex sm:items-center sm:gap-2">
                <button
                  onClick={onOpenPreview}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-fg-muted transition hover:bg-surface-2 hover:text-fg"
                >
                  <Eye className="h-3.5 w-3.5 text-primary" /> View
                </button>
                <div className="relative" ref={exportRef}>
                  <button
                    onClick={() => setExportOpen(!exportOpen)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-fg-muted transition hover:bg-surface-2 hover:text-fg"
                  >
                    <Download className="h-3.5 w-3.5" /> Export
                  </button>
                  {exportOpen && (
                    <div className="absolute right-0 top-10 z-50 w-36 rounded-lg border border-border bg-surface py-1 shadow-elevated">
                      <button
                        onClick={() => handleExport('markdown')}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
                      >
                        Markdown (.md)
                      </button>
                      <button
                        onClick={() => handleExport('json')}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
                      >
                        JSON (.json)
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => void clearActiveChat()}
                  title="Clear chat"
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-fg-muted transition hover:bg-surface-2 hover:text-danger"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Clear
                </button>
              </div>

              {/* Mobile three-dots menu (< sm) — z-50 inside z-30 header */}
              <div className="relative sm:hidden" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-fg-muted transition hover:bg-surface-2"
                  aria-label="More actions"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-10 z-50 w-44 rounded-lg border border-border bg-surface py-1 shadow-elevated">
                    <button
                      onClick={() => { setMenuOpen(false); onOpenPreview(); }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
                    >
                      <Eye className="h-3.5 w-3.5 text-primary" /> View Document
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); handleExport('markdown'); }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
                    >
                      <Download className="h-3.5 w-3.5" /> Export Markdown
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); handleExport('json'); }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
                    >
                      <Download className="h-3.5 w-3.5" /> Export JSON
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); void clearActiveChat(); }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:bg-surface-2 hover:text-danger"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Clear Chat
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          <div className={cn('h-5 w-px bg-border', !activeSession && 'hidden')} />
          <ThemeToggle />
        </div>
      </header>

      {attachedDocs.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-surface/40 px-3 py-1.5 sm:px-6">
          {attachedDocs.map((doc) => (
            <span
              key={doc.documentId}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-fg-muted"
            >
              <FileText className="h-3 w-3 text-primary" />
              <span className="max-w-32 truncate">{doc.documentName}</span>
            </span>
          ))}
        </div>
      )}
    </>
  );
}