import { describe, it, expect } from 'vitest';
import {
  isPdfMime,
  isPdfExtension,
  hasPdfMagicBytes,
  validatePdfFile,
  isWordMime,
  isWordExtension,
  validateWordFile,
  isExcelMime,
  isExcelExtension,
  validateExcelFile,
  isImageMime,
  isImageExtension,
  validateImageFile,
  isTextMime,
  isTextExtension,
  validateTextFile,
  validateUploadedFile,
  detectFileKind,
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

// ===== Word (.docx) =====
describe('isWordMime', () => {
  it('returns true for Word docx mime type', () => {
    expect(isWordMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
  });
  it('returns false for PDF mime', () => {
    expect(isWordMime('application/pdf')).toBe(false);
  });
});

describe('isWordExtension', () => {
  it('returns true for .docx', () => {
    expect(isWordExtension('test.docx')).toBe(true);
  });
  it('returns true for uppercase .DOCX', () => {
    expect(isWordExtension('test.DOCX')).toBe(true);
  });
  it('returns false for legacy .doc', () => {
    expect(isWordExtension('test.doc')).toBe(false);
  });
});

describe('validateWordFile', () => {
  it('validates a correct .docx file (ZIP magic bytes)', () => {
    const file = new File(['dummy'], 'test.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const buffer = createBuffer([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04
    const result = validateWordFile(file, buffer);
    expect(result.ok).toBe(true);
  });

  it('fails for wrong mime', () => {
    const file = new File(['dummy'], 'test.docx', { type: 'application/pdf' });
    const buffer = createBuffer([0x50, 0x4b, 0x03, 0x04]);
    const result = validateWordFile(file, buffer);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Word');
  });

  it('fails for wrong extension', () => {
    const file = new File(['dummy'], 'test.pdf', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const buffer = createBuffer([0x50, 0x4b, 0x03, 0x04]);
    const result = validateWordFile(file, buffer);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('extension');
  });
});

// ===== Excel (.xlsx/.xls/.csv) =====
describe('isExcelMime', () => {
  it('returns true for xlsx mime', () => {
    expect(isExcelMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
  });
  it('returns false for plain text', () => {
    expect(isExcelMime('text/plain')).toBe(false);
  });
});

describe('isExcelExtension', () => {
  it('returns true for .xlsx', () => {
    expect(isExcelExtension('data.xlsx')).toBe(true);
  });
  it('returns true for .xls', () => {
    expect(isExcelExtension('data.xls')).toBe(true);
  });
  it('returns true for .csv', () => {
    expect(isExcelExtension('data.csv')).toBe(true);
  });
  it('returns false for .pdf', () => {
    expect(isExcelExtension('data.pdf')).toBe(false);
  });
});

describe('validateExcelFile', () => {
  it('validates a correct .xlsx file', () => {
    const file = new File(['dummy'], 'data.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const buffer = createBuffer([0x50, 0x4b, 0x03, 0x04]);
    const result = validateExcelFile(file, buffer);
    expect(result.ok).toBe(true);
  });

  it('validates .csv files without requiring ZIP magic bytes', () => {
    const file = new File(['a,b,c'], 'data.csv', { type: 'text/csv' });
    const buffer = createBuffer([0x61, 0x2c, 0x62]); // "a,b"
    const result = validateExcelFile(file, buffer);
    expect(result.ok).toBe(true);
  });
});

// ===== Images =====
describe('isImageMime', () => {
  it('returns true for png/jpeg/webp/gif', () => {
    expect(isImageMime('image/png')).toBe(true);
    expect(isImageMime('image/jpeg')).toBe(true);
    expect(isImageMime('image/webp')).toBe(true);
    expect(isImageMime('image/gif')).toBe(true);
  });
  it('returns false for non-image mime', () => {
    expect(isImageMime('application/pdf')).toBe(false);
    expect(isImageMime('text/plain')).toBe(false);
  });
});

describe('isImageExtension', () => {
  it('returns true for common image extensions', () => {
    expect(isImageExtension('photo.png')).toBe(true);
    expect(isImageExtension('photo.jpg')).toBe(true);
    expect(isImageExtension('photo.jpeg')).toBe(true);
    expect(isImageExtension('photo.webp')).toBe(true);
    expect(isImageExtension('photo.gif')).toBe(true);
  });
  it('returns false for non-image extensions', () => {
    expect(isImageExtension('document.pdf')).toBe(false);
    expect(isImageExtension('archive.zip')).toBe(false);
  });
});

describe('validateImageFile', () => {
  it('validates a correct PNG file', () => {
    const file = new File(['dummy'], 'photo.png', { type: 'image/png' });
    const buffer = createBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = validateImageFile(file, buffer);
    expect(result.ok).toBe(true);
  });

  it('validates a correct JPG file', () => {
    const file = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
    const buffer = createBuffer([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const result = validateImageFile(file, buffer);
    expect(result.ok).toBe(true);
  });

  it('validates a correct GIF file (89a)', () => {
    const file = new File(['dummy'], 'anim.gif', { type: 'image/gif' });
    const buffer = createBuffer([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const result = validateImageFile(file, buffer);
    expect(result.ok).toBe(true);
  });

  it('validates a correct WEBP file', () => {
    const file = new File(['dummy'], 'pic.webp', { type: 'image/webp' });
    const buffer = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size (placeholder)
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]).buffer;
    const result = validateImageFile(file, buffer);
    expect(result.ok).toBe(true);
  });

  it('fails for non-image mime', () => {
    const file = new File(['dummy'], 'photo.png', { type: 'application/pdf' });
    const buffer = createBuffer([0x89, 0x50, 0x4e, 0x47]);
    const result = validateImageFile(file, buffer);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('MIME');
  });

  it('fails for wrong magic bytes', () => {
    const file = new File(['dummy'], 'photo.png', { type: 'image/png' });
    const buffer = createBuffer([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const result = validateImageFile(file, buffer);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('magic');
  });
});

// ===== Plain text / Markdown / CSV =====
describe('isTextMime', () => {
  it('returns true for plain, markdown, csv', () => {
    expect(isTextMime('text/plain')).toBe(true);
    expect(isTextMime('text/markdown')).toBe(true);
    expect(isTextMime('text/csv')).toBe(true);
  });
});

describe('isTextExtension', () => {
  it('returns true for .txt .md .csv', () => {
    expect(isTextExtension('notes.txt')).toBe(true);
    expect(isTextExtension('README.md')).toBe(true);
    expect(isTextExtension('data.csv')).toBe(true);
  });
});

describe('validateTextFile', () => {
  it('validates a .csv file as text', () => {
    const file = new File(['a,b,c'], 'data.csv', { type: 'text/csv' });
    const result = validateTextFile(file);
    expect(result.ok).toBe(true);
  });
});

// ===== Dispatcher =====
describe('detectFileKind', () => {
  it('detects pdf', () => {
    const file = new File([''], 'doc.pdf', { type: 'application/pdf' });
    expect(detectFileKind(file)).toBe('pdf');
  });
  it('detects word', () => {
    const file = new File([''], 'doc.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(detectFileKind(file)).toBe('word');
  });
  it('detects excel', () => {
    const file = new File([''], 'data.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(detectFileKind(file)).toBe('excel');
  });
  it('detects image', () => {
    const file = new File([''], 'pic.png', { type: 'image/png' });
    expect(detectFileKind(file)).toBe('image');
  });
  it('detects text', () => {
    const file = new File([''], 'notes.txt', { type: 'text/plain' });
    expect(detectFileKind(file)).toBe('text');
  });
});

describe('validateUploadedFile (dispatcher)', () => {
  it('dispatches pdf validation', () => {
    const file = new File(['dummy'], 'doc.pdf', { type: 'application/pdf' });
    const buffer = createBuffer([0x25, 0x50, 0x44, 0x46]);
    expect(validateUploadedFile(file, buffer).ok).toBe(true);
  });
  it('dispatches word validation', () => {
    const file = new File(['dummy'], 'doc.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const buffer = createBuffer([0x50, 0x4b, 0x03, 0x04]);
    expect(validateUploadedFile(file, buffer).ok).toBe(true);
  });
  it('dispatches excel validation', () => {
    const file = new File(['dummy'], 'data.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const buffer = createBuffer([0x50, 0x4b, 0x03, 0x04]);
    expect(validateUploadedFile(file, buffer).ok).toBe(true);
  });
  it('dispatches image validation', () => {
    const file = new File(['dummy'], 'pic.png', { type: 'image/png' });
    const buffer = createBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateUploadedFile(file, buffer).ok).toBe(true);
  });
  it('rejects unsupported types', () => {
    const file = new File(['dummy'], 'archive.zip', { type: 'application/zip' });
    const buffer = createBuffer([0x50, 0x4b, 0x03, 0x04]);
    const result = validateUploadedFile(file, buffer);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Only');
  });
});