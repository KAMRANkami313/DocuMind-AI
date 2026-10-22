import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, clearRateLimitStore } from '../rate-limit';

describe('rateLimit (in-memory)', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it('allows first request within limit', async () => {
    const result = await rateLimit('user:test1', {
      points: 5,
      duration: 60,
      keyPrefix: 'test',
    });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it('blocks after exceeding limit', async () => {
    const opts = { points: 3, duration: 60, keyPrefix: 'test' };
    const identifier = 'user:test2';

    for (let i = 0; i < 3; i++) {
      const result = await rateLimit(identifier, opts);
      expect(result.success).toBe(true);
    }

    const result = await rateLimit(identifier, opts);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks remaining count correctly', async () => {
    const opts = { points: 5, duration: 60, keyPrefix: 'test' };
    const identifier = 'user:test3';

    for (let i = 0; i < 3; i++) {
      await rateLimit(identifier, opts);
    }

    const result = await rateLimit(identifier, opts);
    expect(result.remaining).toBe(1);
  });

  it('treats different identifiers independently', async () => {
    const opts = { points: 2, duration: 60, keyPrefix: 'test' };

    await rateLimit('user:A', opts);
    await rateLimit('user:A', opts);

    const blocked = await rateLimit('user:A', opts);
    expect(blocked.success).toBe(false);

    const allowed = await rateLimit('user:B', opts);
    expect(allowed.success).toBe(true);
  });

  it('treats different keyPrefixes independently', async () => {
    const opts1 = { points: 1, duration: 60, keyPrefix: 'upload' };
    const opts2 = { points: 1, duration: 60, keyPrefix: 'chat' };

    const r1 = await rateLimit('user:X', opts1);
    const r2 = await rateLimit('user:X', opts2);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it('returns reset time when blocked', async () => {
    const opts = { points: 1, duration: 60, keyPrefix: 'test' };
    await rateLimit('user:test4', opts);

    const result = await rateLimit('user:test4', opts);
    expect(result.success).toBe(false);
    expect(result.reset).toBeGreaterThan(0);
  });
});