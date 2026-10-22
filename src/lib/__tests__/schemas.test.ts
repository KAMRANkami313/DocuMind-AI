import { describe, it, expect } from 'vitest';
import { chatRequestSchema } from '@/lib/validation/schemas';

describe('chatRequestSchema', () => {
  it('accepts valid request', () => {
    const valid = {
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      messages: [
        { role: 'user', content: 'What is CNN?' },
        { role: 'assistant', content: 'CNN stands for...' },
      ],
    };
    const result = chatRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects missing documentId', () => {
    const invalid = {
      messages: [{ role: 'user', content: 'test' }],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID documentId', () => {
    const invalid = {
      documentId: 'not-a-uuid',
      messages: [{ role: 'user', content: 'test' }],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects empty messages array', () => {
    const invalid = {
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      messages: [],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects messages with empty content', () => {
    const invalid = {
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      messages: [{ role: 'user', content: '' }],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const invalid = {
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      messages: [{ role: 'admin', content: 'test' }],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects content exceeding 10000 characters', () => {
    const invalid = {
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      messages: [{ role: 'user', content: 'x'.repeat(10001) }],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts messages with optional citations', () => {
    const valid = {
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      messages: [
        {
          role: 'assistant',
          content: 'CNN is...',
          citations: [
            { pageNumber: 1, similarity: 0.95 },
          ],
        },
      ],
    };
    const result = chatRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts up to 50 messages', () => {
    const messages = Array.from({ length: 50 }, () => ({
      role: 'user' as const,
      content: 'question',
    }));
    const valid = {
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      messages,
    };
    const result = chatRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects more than 50 messages', () => {
    const messages = Array.from({ length: 51 }, () => ({
      role: 'user' as const,
      content: 'question',
    }));
    const invalid = {
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      messages,
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});