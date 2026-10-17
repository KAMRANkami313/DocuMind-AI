'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  BookOpen,
} from 'lucide-react';
import type { Citation } from '@/types';

export interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  onSelectCitation: (citation: Citation) => void;
  onSelectSuggestion?: (question: string) => void;
  onSaveEdit?: (newContent: string) => void;
  onDeleteMessage?: () => void;
}

export function MessageItem({
  role,
  content,
  citations,
  onSelectCitation,
  onSelectSuggestion,
  onSaveEdit,
  onDeleteMessage,
}: MessageProps) {
  const isUser = role === 'user';
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [showSources, setShowSources] = useState(false);

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

  // Deduplicate citations by page number (keeping highest similarity per page)
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
    <div
      className={`group flex w-full max-w-4xl gap-3 ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}
    >
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-600/20">
          <Bot className="h-4 w-4 text-indigo-400" />
        </div>
      )}

      <div className="relative w-full max-w-2xl space-y-2.5 overflow-hidden">
        <div
          className={`relative rounded-2xl p-4 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-none bg-indigo-600 text-white'
              : 'rounded-bl-none border border-zinc-800 bg-zinc-900 text-zinc-200'
          }`}
        >
          {/* Action buttons on hover */}
          {!isEditing && (
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-black/40 p-1 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
              {isUser && onSaveEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  title="Edit message in-place"
                  className="cursor-pointer p-1 text-zinc-400 transition hover:text-indigo-300"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDeleteMessage && (
                <button
                  onClick={onDeleteMessage}
                  title="Delete message"
                  className="cursor-pointer p-1 text-zinc-400 transition hover:text-red-400"
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
                  className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-sm text-white focus:border-white focus:outline-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={handleCancel}
                    className="flex cursor-pointer items-center gap-1 rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:text-white"
                  >
                    <X className="h-3 w-3" /> Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex cursor-pointer items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-black hover:bg-zinc-200"
                  >
                    <Check className="h-3 w-3" /> Save & Re-run
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{mainContent}</p>
            )
          ) : (
            <div className="prose prose-invert max-w-none space-y-2 overflow-x-auto text-xs leading-relaxed sm:text-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="my-3 overflow-x-auto rounded-lg border border-zinc-800">
                      <table className="min-w-full divide-y divide-zinc-800 text-left text-xs">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="bg-zinc-800/60 px-3 py-2 font-semibold text-zinc-300">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border-t border-zinc-800/60 px-3 py-2 text-zinc-300">
                      {children}
                    </td>
                  ),
                  code: ({ children }) => (
                    <code className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-amber-300">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="my-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-200">
                      {children}
                    </pre>
                  ),
                }}
              >
                {mainContent || '...'}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Collapsible, Deduplicated Sources Accordion */}
        {uniqueCitations.length > 0 && !isEditing && (
          <div className="pt-0.5">
            <button
              onClick={() => setShowSources(!showSources)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
            >
              <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
              <span>{uniqueCitations.length} Cited Sources</span>
              {showSources ? (
                <ChevronUp className="ml-0.5 h-3 w-3" />
              ) : (
                <ChevronDown className="ml-0.5 h-3 w-3" />
              )}
            </button>

            {showSources && (
              <div className="animate-in fade-in mt-2 flex flex-wrap gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2 duration-150">
                {uniqueCitations.map((cite, cIdx) => (
                  <button
                    key={cIdx}
                    onClick={() => onSelectCitation(cite)}
                    className="cursor-pointer rounded border border-zinc-700 bg-zinc-800/90 px-2 py-0.5 text-[11px] text-indigo-300 transition hover:border-indigo-500/40 hover:bg-indigo-600/30"
                  >
                    Page {cite.pageNumber} ({Math.round(cite.similarity * 100)}%)
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dynamic Follow-up Suggestions */}
        {suggestions.length > 0 && onSelectSuggestion && !isEditing && (
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              Suggested Follow-ups:
            </div>
            <div className="flex flex-col gap-1.5">
              {suggestions.map((q, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => onSelectSuggestion(q)}
                  className="group/pill flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/90 p-2.5 text-left text-xs text-zinc-300 transition hover:border-indigo-500/50 hover:bg-indigo-600/10 hover:text-white"
                >
                  <span>{q}</span>
                  <span className="text-[10px] text-indigo-400 opacity-0 transition group-hover/pill:opacity-100">
                    Ask →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800">
          <User className="h-4 w-4 text-zinc-400" />
        </div>
      )}
    </div>
  );
}