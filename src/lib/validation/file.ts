const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46];

export function isPdfMime(mime: string): boolean {
  return mime === 'application/pdf';
}

export function isPdfExtension(filename: string): boolean {
  return /\.pdf$/i.test(filename);
}

export function hasPdfMagicBytes(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const view = new Uint8Array(buffer.slice(0, 4));
  return PDF_MAGIC_BYTES.every((byte, i) => view[i] === byte);
}

export interface FileValidationResult {
  ok: boolean;
  reason?: string;
}

export function validatePdfFile(
  file: File,
  buffer: ArrayBuffer,
): FileValidationResult {
  if (!isPdfMime(file.type)) {
    return { ok: false, reason: 'MIME type is not application/pdf' };
  }
  if (!isPdfExtension(file.name)) {
    return { ok: false, reason: 'File extension is not .pdf' };
  }
  if (!hasPdfMagicBytes(buffer)) {
    return { ok: false, reason: 'File content does not have valid PDF magic bytes' };
  }
  return { ok: true };
}