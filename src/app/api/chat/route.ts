import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/ai/embedding';
import { supabaseAdmin } from '@/lib/supabase/server';
import { groq, buildSystemPrompt } from '@/lib/ai/groq';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { messages, documentId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required.' }, { status: 400 });
    }

    const latestUserMessage = messages[messages.length - 1].content;

    // 1. Generate vector embedding for the incoming question
    const queryVector = await generateEmbedding(latestUserMessage);

    // 2. Query Supabase for top 4 most similar chunks using cosine distance
    const { data: matchedChunks, error: matchError } = await supabaseAdmin.rpc('match_document_chunks', {
      query_embedding: queryVector,
      match_threshold: 0.35, // Balanced threshold for open-source embeddings
      match_count: 4,
      filter_document_id: documentId || null,
    });

    if (matchError) {
      return NextResponse.json({ error: matchError.message }, { status: 500 });
    }

    const context = (matchedChunks || []).map((chunk: any) => ({
      content: chunk.content,
      pageNumber: chunk.page_number,
      similarity: chunk.similarity,
    }));

    // 3. Assemble prompt with strict citation context
    const systemPrompt = buildSystemPrompt(context);

    // 4. Create Groq streaming chat completion
    const stream = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b', // or llama-3.3-70b-versatile
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
      ],
      stream: true,
      temperature: 0.2, // Low temperature prevents hallucinations
    });

    // 5. Stream tokens back to client using Web Streams API
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        // Send citation metadata in the first custom event frame
        const metaEvent = `data: ${JSON.stringify({ citations: context })}\n\n`;
        controller.enqueue(encoder.encode(metaEvent));

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            const data = `data: ${JSON.stringify({ text: content })}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error processing chat query.' }, { status: 500 });
  }
}