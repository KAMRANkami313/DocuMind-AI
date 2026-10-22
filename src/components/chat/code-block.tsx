'use client';

import * as React from 'react';
import { CopyButton } from './copy-button';
import { cn } from '@/lib/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tokenize(code: string): Array<{ text: string; type: string }> {
  const tokens: Array<{ text: string; type: string }> = [];
  const patterns: Array<{ regex: RegExp; type: string }> = [
    { regex: /\/\/[^\n]*/y, type: 'comment' },
    { regex: /#[^\n]*/y, type: 'comment' },
    { regex: /\/\*[\s\S]*?\*\//y, type: 'comment' },
    { regex: /"(?:[^"\\]|\\.)*"/y, type: 'string' },
    { regex: /'(?:[^'\\]|\\.)*'/y, type: 'string' },
    { regex: /`(?:[^`\\]|\\.)*`/y, type: 'string' },
    { regex: /\b\d+\.?\d*\b/y, type: 'number' },
    {
      regex: /\b(?:const|let|var|function|return|if|else|for|while|class|extends|import|export|from|default|async|await|new|try|catch|finally|throw|typeof|instanceof|in|of|this|super|true|false|null|undefined|void|delete|yield|static|public|private|protected|readonly|interface|type|enum|implements|package|abstract|continue|break|switch|case|do|with|debugger|namespace|module|declare|as|is)\b/y,
      type: 'keyword',
    },
    {
      regex: /\b(?:def|print|elif|None|True|False|lambda|with|pass|raise|except|global|nonlocal|assert|del|in|not|or|and|is)\b/y,
      type: 'keyword',
    },
    { regex: /\b[A-Z][A-Za-z0-9_]*\b/y, type: 'type' },
    { regex: /[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/y, type: 'function' },
    { regex: /[{}()\[\]]/y, type: 'bracket' },
    { regex: /[+\-*/%=<>!&|^~?:;,.]/y, type: 'operator' },
  ];

  let pos = 0;
  while (pos < code.length) {
    const slice = code.slice(pos);
    let matched = false;
    for (const { regex, type } of patterns) {
      regex.lastIndex = 0;
      const match = regex.exec(slice);
      if (match && match.index === 0 && match[0].length > 0) {
        tokens.push({ text: match[0], type });
        pos += match[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const nextChar = slice[0];
      if (nextChar) {
        let existing = tokens[tokens.length - 1];
        if (existing && existing.type === 'plain') {
          existing.text += nextChar;
        } else {
          tokens.push({ text: nextChar, type: 'plain' });
          existing = tokens[tokens.length - 1];
        }
        pos += 1;
      }
    }
  }
  return tokens;
}

const tokenColors: Record<string, string> = {
  comment: 'text-fg-subtle italic',
  string: 'text-emerald-500 dark:text-emerald-400',
  number: 'text-amber-600 dark:text-amber-400',
  keyword: 'text-primary font-medium',
  type: 'text-sky-600 dark:text-sky-400',
  function: 'text-cyan-500 dark:text-cyan-400',
  bracket: 'text-fg-muted',
  operator: 'text-fg-muted',
  plain: 'text-fg',
};

export function CodeBlock({ code, language: languageProp, className }: CodeBlockProps) {
  const language = languageProp ?? 'text';
  const [highlighted, setHighlighted] = React.useState<string | null>(null);

  React.useEffect(() => {
    const tokens = tokenize(code);
    const html = tokens
      .map((t) => {
        const colorClass = tokenColors[t.type] ?? tokenColors.plain;
        return `<span class="${colorClass}">${escapeHtml(t.text)}</span>`;
      })
      .join('');
    setHighlighted(html);
  }, [code]);

  return (
    <div
      className={cn(
        'group relative my-3 overflow-hidden rounded-lg border border-border bg-surface',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-3 py-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-fg-subtle">
          {language}
        </span>
        <CopyButton value={code} size="sm" />
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed font-mono">
        {highlighted ? (
          <code
            className="block"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <code className="block text-fg">{code}</code>
        )}
      </pre>
    </div>
  );
}
