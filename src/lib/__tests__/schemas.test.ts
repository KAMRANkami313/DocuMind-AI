import { describe, it, expect } from 'vitest';
import { chatRequestSchema } from '@/lib/validation/schemas';

const VALID_SESSION_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('chatRequestSchema', () => {
  it('accepts valid request', () => {
    const valid = {
      chatSessionId: VALID_SESSION_ID,
      messages: [
        { role: 'user', content: 'What is CNN?' },
        { role: 'assistant', content: 'CNN stands for...' },
      ],
    };
    const result = chatRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects missing chatSessionId', () => {
    const invalid = {
      messages: [{ role: 'user', content: 'test' }],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID chatSessionId', () => {
    const invalid = {
      chatSessionId: 'not-a-uuid',
      messages: [{ role: 'user', content: 'test' }],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects empty messages array', () => {
    const invalid = {
      chatSessionId: VALID_SESSION_ID,
      messages: [],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects messages with empty content', () => {
    const invalid = {
      chatSessionId: VALID_SESSION_ID,
      messages: [{ role: 'user', content: '' }],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const invalid = {
      chatSessionId: VALID_SESSION_ID,
      messages: [{ role: 'admin', content: 'test' }],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects content exceeding 10000 characters', () => {
    const invalid = {
      chatSessionId: VALID_SESSION_ID,
      messages: [{ role: 'user', content: 'x'.repeat(10001) }],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts messages with optional citations', () => {
    const valid = {
      chatSessionId: VALID_SESSION_ID,
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
      chatSessionId: VALID_SESSION_ID,
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
      chatSessionId: VALID_SESSION_ID,
      messages,
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});