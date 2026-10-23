import { describe, it, expect } from 'vitest';
import { exportToMarkdown, exportToJSON } from '@/lib/export';
import type { ChatMessage } from '@/types';

const testMessages: ChatMessage[] = [
  { role: 'user', content: 'What is CNN?' },
  {
    role: 'assistant',
    content: 'CNN stands for Convolutional Neural Network.',
    citations: [
      { chunkId: 'c1', pageNumber: 3, excerpt: 'CNN...', similarity: 0.95 },
    ],
  },
];

describe('exportToMarkdown', () => {
  it('includes document name in header', () => {
    const result = exportToMarkdown(testMessages, 'lecture.pdf');
    expect(result).toContain('# DocuMind AI — lecture.pdf');
  });

  it('includes export timestamp', () => {
    const result = exportToMarkdown(testMessages, 'test.pdf');
    expect(result).toMatch(/Exported on \d{4}-\d{2}-\d{2}/);
  });

  it('includes user messages', () => {
    const result = exportToMarkdown(testMessages, 'test.pdf');
    expect(result).toContain('What is CNN?');
  });

  it('includes assistant messages', () => {
    const result = exportToMarkdown(testMessages, 'test.pdf');
    expect(result).toContain('Convolutional Neural Network');
  });

  it('includes citations when present', () => {
    const result = exportToMarkdown(testMessages, 'test.pdf');
    expect(result).toContain('Page 3');
    expect(result).toContain('95% match');
  });

  it('handles empty messages array', () => {
    const result = exportToMarkdown([], 'empty.pdf');
    expect(result).toContain('# DocuMind AI — empty.pdf');
  });
});

describe('exportToJSON', () => {
  it('returns valid JSON with metadata', () => {
    const result = exportToJSON(testMessages, 'lecture.pdf');
    const parsed = JSON.parse(result);
    expect(parsed.document).toBe('lecture.pdf');
    expect(parsed.messageCount).toBe(2);
    expect(parsed.exportedAt).toBeDefined();
  });

  it('includes message content', () => {
    const result = exportToJSON(testMessages, 'test.pdf');
    const parsed = JSON.parse(result);
    expect(parsed.messages[0].content).toBe('What is CNN?');
    expect(parsed.messages[1].content).toContain('Convolutional');
  });

  it('includes citations in simplified format', () => {
    const result = exportToJSON(testMessages, 'test.pdf');
    const parsed = JSON.parse(result);
    expect(parsed.messages[1].citations[0].page).toBe(3);
    expect(parsed.messages[1].citations[0].similarity).toBe(0.95);
  });

  it('handles empty messages array', () => {
    const result = exportToJSON([], 'empty.pdf');
    const parsed = JSON.parse(result);
    expect(parsed.messageCount).toBe(0);
    expect(parsed.messages).toEqual([]);
  });
});