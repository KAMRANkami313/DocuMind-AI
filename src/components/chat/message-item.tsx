'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Sparkles, Pencil, Trash2, Check, X, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { Citation } from '@/types';

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
    mainContent = parts[0].trim();
    suggestions = parts[1]
      .split('\n')
      .map((s) => s.replace(/^[-*•\d.]\s*/, '').trim())
      .filter((s) => s.length > 5);
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
    <div className={`group flex gap-3 max-w-4xl w-full ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-4 h-4 text-indigo-400" />
        </div>
      )}

      <div className="space-y-2.5 max-w-2xl w-full overflow-hidden relative">
        <div
          className={`p-4 rounded-2xl text-sm leading-relaxed relative ${
            isUser
              ? 'bg-indigo-600 text-white rounded-br-none'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-none'
          }`}
        >
          {/* Action buttons on hover */}
          {!isEditing && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-lg p-1">
              {isUser && onSaveEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  title="Edit message in-place"
                  className="p-1 hover:text-indigo-300 text-zinc-400 transition cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {onDeleteMessage && (
                <button
                  onClick={onDeleteMessage}
                  title="Delete message"
                  className="p-1 hover:text-red-400 text-zinc-400 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
                  className="w-full bg-zinc-950 text-white rounded-lg p-2.5 text-sm border border-zinc-700 focus:outline-none focus:border-white resize-y"
                  rows={3}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={handleCancel}
                    className="px-2.5 py-1 rounded-md text-xs bg-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-2.5 py-1 rounded-md text-xs bg-white text-black font-semibold hover:bg-zinc-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" /> Save & Re-run
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{mainContent}</p>
            )
          ) : (
            <div className="prose prose-invert max-w-none text-xs sm:text-sm leading-relaxed overflow-x-auto space-y-2">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3 border border-zinc-800 rounded-lg">
                      <table className="min-w-full divide-y divide-zinc-800 text-left text-xs">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="bg-zinc-800/60 px-3 py-2 font-semibold text-zinc-300">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 border-t border-zinc-800/60 text-zinc-300">{children}</td>
                  ),
                  code: ({ children }) => (
                    <code className="bg-zinc-950 px-1.5 py-0.5 rounded text-amber-300 font-mono text-xs border border-zinc-800">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-zinc-950 p-3 rounded-lg overflow-x-auto border border-zinc-800 font-mono text-xs text-zinc-200 my-2">
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
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>{uniqueCitations.length} Cited Sources</span>
              {showSources ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
            </button>

            {showSources && (
              <div className="mt-2 flex flex-wrap gap-1.5 p-2 bg-zinc-900/60 border border-zinc-800 rounded-xl animate-in fade-in duration-150">
                {uniqueCitations.map((cite, cIdx) => (
                  <button
                    key={cIdx}
                    onClick={() => onSelectCitation(cite)}
                    className="px-2 py-0.5 rounded text-[11px] bg-zinc-800/90 hover:bg-indigo-600/30 hover:border-indigo-500/40 text-indigo-300 border border-zinc-700 transition cursor-pointer"
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
          <div className="pt-2 space-y-1.5">
            <div className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Suggested Follow-ups:
            </div>
            <div className="flex flex-col gap-1.5">
              {suggestions.map((q, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => onSelectSuggestion(q)}
                  className="text-left text-xs p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-600/10 text-zinc-300 hover:text-white transition cursor-pointer flex items-center justify-between group/pill"
                >
                  <span>{q}</span>
                  <span className="text-[10px] text-indigo-400 opacity-0 group-hover/pill:opacity-100 transition">
                    Ask →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-1">
          <User className="w-4 h-4 text-zinc-400" />
        </div>
      )}
    </div>
  );
}