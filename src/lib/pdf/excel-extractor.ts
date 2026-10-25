// ⚠️ Excel extractor using SheetJS (xlsx). Reads .xlsx, .xls, and .csv.
// Each sheet becomes one "page" of text. Within a sheet, rows are joined
// by newlines and cells by " | " (pipe), so the chunker's natural
// sentence boundaries still work for vector search.

import type { ExtractedPage } from './extractor';

function sanitizeText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

interface XlsxWorkbook {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
}

export async function extractTextFromExcel(
  buffer: ArrayBuffer,
): Promise<ExtractedPage[]> {
  // Dynamic import keeps SheetJS out of the client bundle.
  const Xlsx = await import('xlsx');
  const workbook: XlsxWorkbook = Xlsx.read(buffer, {
    type: 'array',
    cellDates: true,
    cellNF: false,
    cellText: false,
  });

  const pages: ExtractedPage[] = [];

  for (let i = 0; i < workbook.SheetNames.length; i++) {
    const sheetName = workbook.SheetNames[i]!;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert sheet to an array-of-arrays, then to a TSV-ish string.
    // `sheet_to_csv` with FS=| keeps cells visually separated so the
    // chunker doesn't merge adjacent cells into nonsense tokens.
    const csv = Xlsx.utils.sheet_to_csv(sheet as unknown as Parameters<typeof Xlsx.utils.sheet_to_csv>[0], {
      FS: ' | ',
      RS: '\n',
      blankrows: false,
      skipHidden: true,
    });

    if (csv && csv.trim().length > 0) {
      pages.push({
        pageNumber: i + 1,
        text: sanitizeText(`Sheet: ${sheetName}\n${csv}`.trim()),
      });
    }
  }

  if (pages.length === 0) {
    throw new Error('No readable text found in this spreadsheet.');
  }

  return pages;
}