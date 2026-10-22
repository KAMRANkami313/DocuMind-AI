import { describe, it, expect } from 'vitest';
import {
  isPdfMime,
  isPdfExtension,
  hasPdfMagicBytes,
  validatePdfFile,
} from '@/lib/validation/file';

function createBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe('isPdfMime', () => {
  it('returns true for application/pdf', () => {
    expect(isPdfMime('application/pdf')).toBe(true);
  });

  it('returns false for other MIME types', () => {
    expect(isPdfMime('text/plain')).toBe(false);
    expect(isPdfMime('image/png')).toBe(false);
    expect(isPdfMime('')).toBe(false);
  });
});

describe('isPdfExtension', () => {
  it('returns true for .pdf files', () => {
    expect(isPdfExtension('document.pdf')).toBe(true);
  });

  it('returns true for uppercase .PDF', () => {
    expect(isPdfExtension('document.PDF')).toBe(true);
  });

  it('returns false for non-PDF extensions', () => {
    expect(isPdfExtension('document.docx')).toBe(false);
    expect(isPdfExtension('document.txt')).toBe(false);
    expect(isPdfExtension('document')).toBe(false);
  });
});

describe('hasPdfMagicBytes', () => {
  it('returns true for valid PDF header', () => {
    const buffer = createBuffer([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(hasPdfMagicBytes(buffer)).toBe(true);
  });

  it('returns false for non-PDF content', () => {
    const buffer = createBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(hasPdfMagicBytes(buffer)).toBe(false);
  });

  it('returns false for empty buffer', () => {
    expect(hasPdfMagicBytes(new ArrayBuffer(0))).toBe(false);
  });

  it('returns false for buffer shorter than 4 bytes', () => {
    expect(hasPdfMagicBytes(createBuffer([0x25, 0x50]))).toBe(false);
  });

  it('returns false for buffer with wrong first bytes', () => {
    expect(hasPdfMagicBytes(createBuffer([0x00, 0x00, 0x00, 0x00]))).toBe(false);
  });
});

describe('validatePdfFile', () => {
  it('validates a correct PDF file', () => {
    const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    const buffer = createBuffer([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const result = validatePdfFile(file, buffer);
    expect(result.ok).toBe(true);
  });

  it('fails for wrong MIME type', () => {
    const file = new File(['dummy'], 'test.pdf', { type: 'text/plain' });
    const buffer = createBuffer([0x25, 0x50, 0x44, 0x46]);
    const result = validatePdfFile(file, buffer);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('MIME');
  });

  it('fails for wrong extension', () => {
    const file = new File(['dummy'], 'test.txt', { type: 'application/pdf' });
    const buffer = createBuffer([0x25, 0x50, 0x44, 0x46]);
    const result = validatePdfFile(file, buffer);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('extension');
  });

  it('fails for wrong magic bytes', () => {
    const file = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
    const buffer = createBuffer([0x89, 0x50, 0x4e, 0x47]);
    const result = validatePdfFile(file, buffer);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('magic bytes');
  });
});