// ⚠️ Multi-format file validation. Each validator checks MIME type, file
// extension, AND magic bytes where applicable. The dispatcher
// `validateUploadedFile` returns a result the upload route can use to
// pick the correct extractor.

const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46];
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47];
const JPG_MAGIC_BYTES = [0xff, 0xd8, 0xff];
const GIF_MAGIC_BYTES = [0x47, 0x49, 0x46, 0x38];
const WEBP_RIFF_BYTES = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_WEBP_BYTES = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
const DOCX_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04]; // ZIP local-file-header
const XLSX_MAGIC_BYTES = [0x50, 0x4b, 0x03, 0x04]; // same — ZIP-based

const TEXT_MIME_TYPES = ['text/plain', 'text/markdown', 'text/csv'];
const TEXT_EXTENSIONS = /\.(txt|md|csv)$/i;

const PDF_MIME = 'application/pdf';
const PDF_EXTENSION = /\.pdf$/i;

const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const WORD_EXTENSION = /\.docx$/i;

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXCEL_EXTENSIONS = /\.(xlsx|xls|csv)$/i;

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif)$/i;

// ---------- PDF ----------
export function isPdfMime(mime: string): boolean {
  return mime === PDF_MIME;
}
export function isPdfExtension(filename: string): boolean {
  return PDF_EXTENSION.test(filename);
}
export function hasPdfMagicBytes(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const view = new Uint8Array(buffer.slice(0, 4));
  return PDF_MAGIC_BYTES.every((byte, i) => view[i] === byte);
}

// ---------- Word (.docx) ----------
export function isWordMime(mime: string): boolean {
  return mime === WORD_MIME;
}
export function isWordExtension(filename: string): boolean {
  return WORD_EXTENSION.test(filename);
}
function hasDocxMagicBytes(buffer: ArrayBuffer): boolean {
  // .docx is a ZIP archive — check the ZIP local file header signature.
  if (buffer.byteLength < 4) return false;
  const view = new Uint8Array(buffer.slice(0, 4));
  return DOCX_MAGIC_BYTES.every((byte, i) => view[i] === byte);
}

// ---------- Excel (.xlsx/.xls/.csv) ----------
export function isExcelMime(mime: string): boolean {
  return mime === EXCEL_MIME;
}
export function isExcelExtension(filename: string): boolean {
  return EXCEL_EXTENSIONS.test(filename);
}
function hasXlsxMagicBytes(buffer: ArrayBuffer): boolean {
  // .xlsx is a ZIP archive — same magic bytes as .docx
  if (buffer.byteLength < 4) return false;
  const view = new Uint8Array(buffer.slice(0, 4));
  return XLSX_MAGIC_BYTES.every((byte, i) => view[i] === byte);
}

// ---------- Plain text / Markdown / CSV ----------
export function isTextMime(mime: string): boolean {
  return TEXT_MIME_TYPES.includes(mime);
}
export function isTextExtension(filename: string): boolean {
  return TEXT_EXTENSIONS.test(filename);
}

// ---------- Images (PNG / JPG / WEBP / GIF) ----------
export function isImageMime(mime: string): boolean {
  return IMAGE_MIME_TYPES.includes(mime);
}
export function isImageExtension(filename: string): boolean {
  return IMAGE_EXTENSIONS.test(filename);
}
function hasImageMagicBytes(buffer: ArrayBuffer, filename: string): boolean {
  if (buffer.byteLength < 4) return false;
  const view = new Uint8Array(buffer.slice(0, 12));

  // PNG
  if (PNG_MAGIC_BYTES.every((byte, i) => view[i] === byte)) return true;

  // JPG: FF D8 FF (next byte is a segment marker, any value 0x00–0xFF)
  if (
    JPG_MAGIC_BYTES[0] === view[0] &&
    JPG_MAGIC_BYTES[1] === view[1] &&
    JPG_MAGIC_BYTES[2] === view[2]
  ) {
    return true;
  }

  // GIF87a / GIF89a — bytes: "GIF8" then 0x37 ("7") or 0x39 ("9"), then 0x61 ("a")
  if (
    GIF_MAGIC_BYTES.every((byte, i) => view[i] === byte) &&
    (view[4] === 0x37 || view[4] === 0x39) &&
    view[5] === 0x61
  ) {
    return true;
  }

  // WEBP: starts with "RIFF" .... "WEBP" at offset 8
  if (
    WEBP_RIFF_BYTES.every((byte, i) => view[i] === byte) &&
    WEBP_WEBP_BYTES.every((byte, i) => view[8 + i] === byte)
  ) {
    return true;
  }

  void filename; // filename not used; magic bytes alone decide
  return false;
}

// ---------- File-kind discriminators ----------
// Useful for the upload route to dispatch to the right extractor.
export type FileKind = 'pdf' | 'text' | 'word' | 'excel' | 'image';

export function detectFileKind(file: File): FileKind {
  if (isPdfMime(file.type) || isPdfExtension(file.name)) return 'pdf';
  if (isWordMime(file.type) || isWordExtension(file.name)) return 'word';
  if (isExcelMime(file.type) || isExcelExtension(file.name)) return 'excel';
  if (isImageMime(file.type) || isImageExtension(file.name)) return 'image';
  if (isTextMime(file.type) || isTextExtension(file.name)) return 'text';
  return 'text'; // default fallback — let the extractor try
}

// ---------- Validators ----------
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

export function validateTextFile(file: File): FileValidationResult {
  if (!isTextMime(file.type)) {
    return { ok: false, reason: 'MIME type is not text/plain, text/markdown, or text/csv' };
  }
  if (!isTextExtension(file.name)) {
    return { ok: false, reason: 'File extension is not .txt, .md, or .csv' };
  }
  return { ok: true };
}

export function validateWordFile(
  file: File,
  buffer: ArrayBuffer,
): FileValidationResult {
  if (!isWordMime(file.type)) {
    return { ok: false, reason: 'MIME type is not a Word document' };
  }
  if (!isWordExtension(file.name)) {
    return { ok: false, reason: 'File extension is not .docx' };
  }
  if (!hasDocxMagicBytes(buffer)) {
    return { ok: false, reason: 'File content does not have valid ZIP magic bytes for .docx' };
  }
  return { ok: true };
}

export function validateExcelFile(
  file: File,
  buffer: ArrayBuffer,
): FileValidationResult {
  if (!isExcelMime(file.type) && !isExcelExtension(file.name)) {
    return { ok: false, reason: 'MIME type / extension is not a spreadsheet' };
  }
  // .csv is plain text — no ZIP magic bytes
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  if (!isCsv && !hasXlsxMagicBytes(buffer)) {
    return { ok: false, reason: 'File content does not have valid ZIP magic bytes for .xlsx' };
  }
  return { ok: true };
}

export function validateImageFile(
  file: File,
  buffer: ArrayBuffer,
): FileValidationResult {
  if (!isImageMime(file.type)) {
    return { ok: false, reason: 'MIME type is not a supported image type (png/jpeg/webp/gif)' };
  }
  if (!isImageExtension(file.name)) {
    return { ok: false, reason: 'File extension is not a supported image type (.png/.jpg/.jpeg/.webp/.gif)' };
  }
  if (!hasImageMagicBytes(buffer, file.name)) {
    return { ok: false, reason: 'File content does not have valid image magic bytes' };
  }
  return { ok: true };
}

export function validateUploadedFile(
  file: File,
  buffer: ArrayBuffer,
): FileValidationResult {
  if (isPdfMime(file.type) || isPdfExtension(file.name)) {
    return validatePdfFile(file, buffer);
  }
  if (isWordMime(file.type) || isWordExtension(file.name)) {
    return validateWordFile(file, buffer);
  }
  if (isExcelMime(file.type) || isExcelExtension(file.name)) {
    return validateExcelFile(file, buffer);
  }
  if (isImageMime(file.type) || isImageExtension(file.name)) {
    return validateImageFile(file, buffer);
  }
  if (isTextMime(file.type) || isTextExtension(file.name)) {
    return validateTextFile(file);
  }
  return {
    ok: false,
    reason:
      'Only PDF, TXT, MD, CSV, DOCX, XLSX, XLS, PNG, JPG, JPEG, WEBP, and GIF files are supported',
  };
}