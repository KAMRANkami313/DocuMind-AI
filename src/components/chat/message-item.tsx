'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { InlineMath, BlockMath } from 'react-katex';
import {
  Bot,
  User,
  Sparkles,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Citation } from '@/types';
import { CodeBlock } from './code-block';
import { CopyButton } from './copy-button';
import { InlineCitation } from './inline-citation';
import { RegenerateButton } from './regenerate-button';
import { cn } from '@/lib/utils';

export interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
  onSelectCitation: (citation: Citation) => void;
  onSelectSuggestion?: (question: string) => void;
  onSaveEdit?: (newContent: string) => void;
  onDeleteMessage?: () => void;
  onRegenerate?: () => void;
  isLast?: boolean;
}

const motionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export function MessageItem({
  role,
  content,
  citations,
  isStreaming,
  onSelectCitation,
  onSelectSuggestion,
  onSaveEdit,
  onDeleteMessage,
  onRegenerate,
  isLast,
}: MessageProps) {
  const isUser = role === 'user';
  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(content);
  const [showSources, setShowSources] = React.useState(false);

  let mainContent = content;
  let suggestions: string[] = [];

  if (!isUser && content.includes('<<<SUGGESTIONS>>>')) {
    const parts = content.split('<<<SUGGESTIONS>>>');
    const firstPart = parts[0];
    const secondPart = parts[1];

    if (firstPart !== undefined) {
      mainContent = firstPart.trim();
    }
    if (secondPart !== undefined) {
      suggestions = secondPart
        .split('\n')
        .map((s) => s.replace(/^[-*•\d.]\s*/, '').trim())
        .filter((s) => s.length > 5);
    }
  }

  const uniqueCitations = React.useMemo(() => {
    if (!citations || citations.length === 0) return [];
    const map = new Map<number, Citation>();
    for (const c of citations) {
      const existing = map.get(c.pageNumber);
      if (!existing || c.similarity > existing.similarity) {
        map.set(c.pageNumber, c);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.pageNumber - b.pageNumber);
  }, [citations]);

  function handleSave() {
    if (!editText.trim()) return;
    setIsEditing(false);
    if (onSaveEdit) onSaveEdit(editText.trim());
  }

  function handleCancel() {
    setEditText(content);
    setIsEditing(false);
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={motionVariants}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'group flex w-full max-w-3xl gap-3',
        isUser ? 'ml-auto justify-end' : 'mr-auto justify-start',
      )}
    >
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 shadow-md shadow-primary/20">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}

      <div className="relative w-full max-w-2xl space-y-2 overflow-hidden">
        <div
          className={cn(
            'relative rounded-2xl p-4 text-sm leading-relaxed',
            isUser
              ? 'rounded-br-md bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-primary/20'
              : 'rounded-bl-md border border-border bg-surface text-fg',
          )}
        >
          {!isEditing && (
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-surface/80 p-1 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 border border-border">
              {!isUser && (
                <CopyButton value={mainContent} size="sm" className="text-fg-muted" />
              )}
              {isUser && onSaveEdit && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  title="Edit message in-place"
                  className="cursor-pointer p-1 text-fg-muted transition hover:text-primary"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDeleteMessage && (
                <button
                  type="button"
                  onClick={onDeleteMessage}
                  title="Delete message"
                  className="cursor-pointer p-1 text-fg-muted transition hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {isUser ? (
            isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full resize-y rounded-lg bg-white/10 p-2.5 text-sm text-white border border-white/20 focus:border-white/40 focus:outline-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex cursor-pointer items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-xs text-white/80 hover:bg-white/20 hover:text-white"
                  >
                    <X className="h-3 w-3" /> Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex cursor-pointer items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-white/90"
                  >
                    <Check className="h-3 w-3" /> Save & Re-run
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{mainContent}</p>
            )
          ) : (
            <div className="prose-documind max-w-none space-y-2 overflow-x-auto text-xs leading-relaxed sm:text-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                components={{
                  table: ({ children }) => (
                    <div className="my-3 overflow-x-auto rounded-lg border border-border">
                      <table className="min-w-full divide-y divide-border text-left text-xs">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="bg-surface-2 px-3 py-2 font-semibold text-fg">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border-t border-border px-3 py-2 text-fg-muted">
                      {children}
                    </td>
                  ),
                  code: ({ className, children }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-primary border border-border">
                          {children}
                        </code>
                      );
                    }
                    const codeString = String(children).replace(/\n$/, '');
                    return (
                      <CodeBlock
                        code={codeString}
                        language={className?.replace('language-', '')}
                      />
                    );
                  },
                  pre: ({ children }) => <>{children}</>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline underline-offset-2 hover:text-primary-hover"
                    >
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-primary/40 pl-3 text-fg-muted italic">
                      {children}
                    </blockquote>
                  ),
                  ...({
                    math: ({ value }: { value: string }) => (
                      <div className="my-3 overflow-x-auto">
                        <BlockMath math={value} />
                      </div>
                    ),
                    inlineMath: ({ value }: { value: string }) => (
                      <InlineMath math={value} />
                    ),
                  } as Record<string, unknown>),
                } as Components}
              >
                {mainContent || (isStreaming ? '▌' : '...')}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {uniqueCitations.length > 0 && !isEditing && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowSources(!showSources)}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                'bg-surface border border-border text-fg-muted transition-colors',
                'hover:bg-surface-2 hover:text-fg',
              )}
            >
              <Sparkles className="h-3 w-3 text-primary" />
              <span>{uniqueCitations.length} sources</span>
              {showSources ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {showSources && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {uniqueCitations.map((cite, cIdx) => (
                  <InlineCitation
                    key={cIdx}
                    citation={cite}
                    onClick={onSelectCitation}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {suggestions.length > 0 && onSelectSuggestion && !isEditing && (
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            {suggestions.map((q, sIdx) => (
              <button
                key={sIdx}
                type="button"
                onClick={() => onSelectSuggestion(q)}
                className={cn(
                  'group/chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs',
                  'bg-surface border border-border text-fg-muted transition-all',
                  'hover:border-primary/30 hover:bg-primary-soft hover:text-primary',
                  'cursor-pointer',
                )}
              >
                <span className="truncate max-w-md">{q}</span>
              </button>
            ))}
          </div>
        )}

        {!isUser && !isStreaming && onRegenerate && isLast && (
          <div className="flex items-center gap-1 pt-1">
            <RegenerateButton onClick={onRegenerate} />
            <CopyButton value={mainContent} size="sm" />
          </div>
        )}
      </div>

      {isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2">
          <User className="h-4 w-4 text-fg-muted" />
        </div>
      )}
    </motion.div>
  );
}
