import { extractText } from 'unpdf';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

function sanitizeText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export async function extractPagesFromPdf(buffer: ArrayBuffer): Promise<ExtractedPage[]> {
  const { text, totalPages } = await extractText(buffer);

  if (!text || totalPages === 0) {
    throw new Error('Failed to extract text or PDF is empty.');
  }

  if (Array.isArray(text)) {
    return text.map((pageText, index) => ({
      pageNumber: index + 1,
      text: sanitizeText(pageText.trim()),
    }));
  }

  return [
    {
      pageNumber: 1,
      text: sanitizeText(String(text).trim()),
    },
  ];
}
