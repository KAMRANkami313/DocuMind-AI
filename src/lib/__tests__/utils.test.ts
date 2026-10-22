import { describe, it, expect } from 'vitest';
import {
  cn,
  formatBytes,
  formatPercent,
  truncate,
  sleep,
  isClient,
  assertNever,
  safeJsonParse,
  generateId,
} from '../utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'skip', 'added')).toBe('base added');
  });

  it('resolves tailwind conflicts (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

describe('formatBytes', () => {
  it('returns 0 B for zero or negative', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-1)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500.00 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
  });

  it('respects decimals parameter', () => {
    expect(formatBytes(1536, 0)).toBe('2 KB');
  });
});

describe('formatPercent', () => {
  it('returns 0% for invalid numbers', () => {
    expect(formatPercent(NaN)).toBe('0%');
    expect(formatPercent(Infinity)).toBe('0%');
  });

  it('formats whole percents', () => {
    expect(formatPercent(0.5)).toBe('50%');
    expect(formatPercent(1)).toBe('100%');
  });

  it('formats with fraction digits', () => {
    expect(formatPercent(0.333, 1)).toBe('33.3%');
  });
});

describe('truncate', () => {
  it('returns short text unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long text with ellipsis', () => {
    const result = truncate('a'.repeat(100), 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('\u2026')).toBe(true);
  });
});

describe('sleep', () => {
  it('resolves after the given milliseconds', async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});

describe('isClient', () => {
  it('returns true in jsdom test environment', () => {
    expect(isClient()).toBe(true);
  });
});

describe('assertNever', () => {
  it('throws for any value', () => {
    expect(() => assertNever('something' as never)).toThrow('Unexpected value');
  });
});

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"key":"value"}', null)).toEqual({ key: 'value' });
  });

  it('returns fallback for invalid JSON', () => {
    expect(safeJsonParse('not json', 'fallback')).toBe('fallback');
  });

  it('returns fallback for null/undefined', () => {
    expect(safeJsonParse(null, 'default')).toBe('default');
    expect(safeJsonParse(undefined, 'default')).toBe('default');
  });
});

describe('generateId', () => {
  it('returns a string with prefix', () => {
    const id = generateId('test');
    expect(id).toMatch(/^test_/);
  });

  it('generates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
});