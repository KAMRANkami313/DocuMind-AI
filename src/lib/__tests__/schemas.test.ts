import { describe, it, expect } from 'vitest';
import { chatRequestSchema } from '@/lib/validation/schemas';

const VALID_SESSION_ID = '550e8400-e29b-41d4-a716-446655440000';
const GUEST_SESSION_ID = 'guest-session_abc123def456';

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

  it('accepts guest session IDs (non-UUID, prefixed)', () => {
    const valid = {
      chatSessionId: GUEST_SESSION_ID,
      messages: [{ role: 'user', content: 'test' }],
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

  it('rejects empty chatSessionId', () => {
    const invalid = {
      chatSessionId: '',
      messages: [{ role: 'user', content: 'test' }],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects chatSessionId exceeding 100 characters', () => {
    const invalid = {
      chatSessionId: 'x'.repeat(101),
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

  it('accepts optional documentIds array (guest mode)', () => {
    const valid = {
      chatSessionId: GUEST_SESSION_ID,
      messages: [{ role: 'user', content: 'test' }],
      documentIds: [VALID_SESSION_ID, '123e4567-e89b-12d3-a456-426614174000'],
    };
    const result = chatRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects documentIds with non-UUID entries', () => {
    const invalid = {
      chatSessionId: GUEST_SESSION_ID,
      messages: [{ role: 'user', content: 'test' }],
      documentIds: ['not-a-uuid'],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects more than 3 documentIds', () => {
    const invalid = {
      chatSessionId: GUEST_SESSION_ID,
      messages: [{ role: 'user', content: 'test' }],
      documentIds: [VALID_SESSION_ID, VALID_SESSION_ID, VALID_SESSION_ID, VALID_SESSION_ID],
    };
    const result = chatRequestSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});