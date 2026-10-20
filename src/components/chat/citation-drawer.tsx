'use client';

import { BookText } from 'lucide-react';
import { Sheet, SheetHeader, SheetBody, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import type { Citation } from '@/types';

interface CitationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citation: Citation | null;
}

export function CitationDrawer({ isOpen, onClose, citation }: CitationDrawerProps) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} side="right">
      <SheetHeader
        title={
          <div className="flex items-center gap-2 text-fg font-semibold text-sm">
            <BookText className="h-4 w-4 text-primary" />
            Document Source Excerpt
          </div>
        }
        onClose={onClose}
      />

      {citation ? (
        <SheetBody className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-soft text-primary border border-primary/20">
              Page {citation.pageNumber}
            </span>
            <span className="text-xs text-fg-muted">
              Relevance: {Math.round(citation.similarity * 100)}%
            </span>
          </div>

          <div className="p-4 rounded-xl bg-bg border border-border text-fg text-xs leading-relaxed whitespace-pre-wrap font-mono">
            {citation.excerpt}
          </div>
        </SheetBody>
      ) : (
        <SheetBody>
          <div className="flex h-full items-center justify-center text-fg-muted text-xs">
            No citation selected.
          </div>
        </SheetBody>
      )}

      <SheetFooter>
        <Button variant="secondary" onClick={onClose}>
          Close Preview
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
