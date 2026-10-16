import { extractText } from 'unpdf';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export async function extractPagesFromPdf(buffer: ArrayBuffer): Promise<ExtractedPage[]> {
  const { text, totalPages } = await extractText(buffer);

  if (!text || totalPages === 0) {
    throw new Error('Failed to extract text or PDF is empty.');
  }

  // unpdf returns an array of strings when pages are separated
  if (Array.isArray(text)) {
    return text.map((pageText, index) => ({
      pageNumber: index + 1,
      text: pageText.trim(),
    }));
  }

  return [
    {
      pageNumber: 1,
      text: String(text).trim(),
    },
  ];
}