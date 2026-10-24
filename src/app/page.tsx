'use client';

import * as React from 'react';
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
  const previewDocId = attachedDocs[0]?.documentId;
  const previewDocName = attachedDocs[0]?.documentName ?? activeSession?.title ?? '';

  return (
    <div className="flex h-screen overflow-hidden bg-bg font-sans text-fg antialiased">
      <div className={cn('hidden lg:flex transition-all duration-200', sidebarCollapsed && 'w-0 overflow-hidden')}>
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>
      <MobileSidebar />
      <main className="relative flex flex-1 flex-col bg-bg">
        <Header onOpenPreview={() => setIsPreviewOpen(true)} />
        <MessagesFeed />
        <ChatInput />
      </main>
      <CitationDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} citation={selectedCitation} />
      <AuthModal isOpen={isAuthOpen} onClose={closeAuth} />
      <PdfPreviewer
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        documentId={previewDocId}
        fileName={previewDocName}
      />
    </div>
  );
}