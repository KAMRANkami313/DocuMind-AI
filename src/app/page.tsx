'use client';

import * as React from 'react';
import { PanelLeft } from 'lucide-react';
import { AuthModal } from '@/components/auth/auth-modal';
import { ChatInput } from '@/components/layout/chat-input';
import { Header } from '@/components/layout/header';
import { MessagesFeed } from '@/components/layout/messages-feed';
import { MobileSidebar } from '@/components/layout/mobile-sidebar';
import { Sidebar } from '@/components/layout/sidebar';
import { CitationDrawer } from '@/components/chat/citation-drawer';
import { PdfPreviewer } from '@/components/document/pdf-previewer';
import { useAuth } from '@/hooks/use-auth';
import { useChat } from '@/hooks/use-chat';
import { cn } from '@/lib/utils';

export default function DocumentQAPage() {
  const { isAuthOpen, closeAuth } = useAuth();
  const {
    activeSession,
    attachedDocs,
    isPreviewOpen,
    setIsPreviewOpen,
    isDrawerOpen,
    setIsDrawerOpen,
    selectedCitation,
  } = useChat();

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-bg font-sans text-fg antialiased">
      <div className={cn('hidden lg:flex transition-all duration-200', sidebarCollapsed && 'w-0 overflow-hidden')}>
        {!sidebarCollapsed && (
          <Sidebar onToggleCollapse={() => setSidebarCollapsed(true)} />
        )}
      </div>
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="hidden lg:flex fixed left-3 top-3 z-40 h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-fg-muted transition hover:bg-surface-2 cursor-pointer"
          aria-label="Open sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}
      <MobileSidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <main className="relative flex flex-1 flex-col bg-bg min-w-0">
        <Header
          onOpenPreview={() => setIsPreviewOpen(true)}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        />
        <MessagesFeed />
        <ChatInput />
      </main>
      <CitationDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} citation={selectedCitation} />
      <AuthModal isOpen={isAuthOpen} onClose={closeAuth} />
      <PdfPreviewer
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        attachedDocs={attachedDocs}
        sessionTitle={activeSession?.title ?? ''}
      />
    </div>
  );
}