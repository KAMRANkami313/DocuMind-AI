import { type NextRequest, NextResponse } from 'next/server';
import { extractPagesFromPdf } from '@/lib/pdf/extractor';
import { splitTextIntoChunks } from '@/lib/pdf/chunker';
import { generateEmbedding } from '@/lib/ai/embedding';
import { supabaseAdmin } from '@/lib/supabase/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF documents are supported.' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must not exceed 10MB.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();

    // 1. Extract pages
    const pages = await extractPagesFromPdf(arrayBuffer);

    // 2. Split into overlapping chunks
    const rawChunks = splitTextIntoChunks(pages);

    if (rawChunks.length === 0) {
      return NextResponse.json({ error: 'Document contains no readable text.' }, { status: 400 });
    }

    // 3. Create document record with user_id attached
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .insert({
        title: file.name.replace(/\.[^/.]+$/, ''),
        file_name: file.name,
        user_id: userId || null, // Associates with user in cloud
      })
      .select('id')
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Failed to record document metadata.' }, { status: 500 });
    }

    // 4. Generate embeddings and prepare batch insert
    const chunksWithEmbeddings = [];
    for (const chunk of rawChunks) {
      const embedding = await generateEmbedding(chunk.content);
      chunksWithEmbeddings.push({
        document_id: document.id,
        content: chunk.content,
        page_number: chunk.pageNumber,
        embedding,
      });
    }

    // 5. Bulk insert chunks
    const { error: chunkError } = await supabaseAdmin
      .from('document_chunks')
      .insert(chunksWithEmbeddings);

    if (chunkError) {
      return NextResponse.json({ error: 'Failed to store document chunks.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      documentId: document.id,
      fileName: file.name,
      totalChunks: chunksWithEmbeddings.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Server error processing PDF.' },
      { status: 500 },
    );
  }
}
