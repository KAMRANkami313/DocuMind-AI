'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Sparkles } from 'lucide-react';
import { Citation } from '@/types';

export interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  onSelectCitation: (citation: Citation) => void;
  onSelectSuggestion?: (question: string) => void;
}

export function MessageItem({ role, content, citations, onSelectCitation, onSelectSuggestion }: MessageProps) {
  const isUser = role === 'user';

  // Separate main body from dynamic AI suggestions
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

  return (
    <div className={`flex gap-3 max-w-4xl w-full ${isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-4 h-4 text-indigo-400" />
        </div>
      )}

      <div className="space-y-3 max-w-2xl w-full overflow-hidden">
        <div
          className={`p-4 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-indigo-600 text-white rounded-br-none'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-none'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{mainContent}</p>
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

        {/* Clickable Citations */}
        {citations && citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">Sources:</span>
            {citations.map((cite, cIdx) => (
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

        {/* Dynamic Clickable Follow-up Suggestions */}
        {suggestions.length > 0 && onSelectSuggestion && (
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
                  className="text-left text-xs p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-600/10 text-zinc-300 hover:text-white transition cursor-pointer flex items-center justify-between group"
                >
                  <span>{q}</span>
                  <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition">Ask →</span>
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