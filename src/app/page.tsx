'use client';

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

export default function DocumentQAPage() {
  const { isAuthOpen, closeAuth } = useAuth();
  const {
    activeDoc,
    isPreviewOpen,
    setIsPreviewOpen,
    isDrawerOpen,
    setIsDrawerOpen,
    selectedCitation,
  } = useChat();

  return (
    <div className="flex h-screen overflow-hidden bg-bg font-sans text-fg antialiased">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      <MobileSidebar />

      <main className="relative flex flex-1 flex-col bg-bg">
        <Header onOpenPreview={() => setIsPreviewOpen(true)} />
        <MessagesFeed />
        <ChatInput />
      </main>

      <CitationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        citation={selectedCitation}
      />

      <AuthModal isOpen={isAuthOpen} onClose={closeAuth} />

      <PdfPreviewer
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        documentId={activeDoc?.id}
        fileName={activeDoc ? activeDoc.name : ''}
        fileBlobUrl={activeDoc?.blobUrl}
      />
    </div>
  );
}