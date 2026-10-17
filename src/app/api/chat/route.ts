import { type NextRequest, NextResponse } from 'next/server';
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

    const latestUserMessage = messages[messages.length - 1].content.trim();

    // Contextual query rewriting for short conversational follow-ups
    let queryForSearch = latestUserMessage;
    if (latestUserMessage.split(' ').length <= 3 && messages.length >= 3) {
      const prevUserMessage = messages[messages.length - 3]?.content || '';
      queryForSearch = `${prevUserMessage} ${latestUserMessage}`;
    }

    // 1. Fetch document metadata
    let docTitle = 'Uploaded Document';
    if (documentId) {
      const { data: docData } = await supabaseAdmin
        .from('documents')
        .select('title')
        .eq('id', documentId)
        .single();
      if (docData?.title) docTitle = docData.title;
    }

    let context: { content: string; pageNumber: number; similarity: number }[] = [];

    if (documentId) {
      // 2. Count total chunks for this document
      const { count } = await supabaseAdmin
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId);

      const totalChunks = count || 0;

      // 3. ZERO REGEX UNIVERSAL LOGIC:
      // If document is <= 35 chunks (presentations, slide decks, short papers):
      // Give the model the COMPLETE document so it can answer summaries, specific slides,
      // and comparisons without missing any page!
      if (totalChunks <= 35) {
        const { data: allChunks } = await supabaseAdmin
          .from('document_chunks')
          .select('content, page_number')
          .eq('document_id', documentId)
          .order('page_number', { ascending: true });

        if (allChunks) {
          context = allChunks.map((c: any) => ({
            content: c.content,
            pageNumber: c.page_number,
            similarity: 0.95,
          }));
        }
      } else {
        // For large documents (> 35 chunks): Hybrid Vector + Intro Pages
        const queryVector = await generateEmbedding(queryForSearch);

        const { data: matchedChunks } = await supabaseAdmin.rpc('match_document_chunks', {
          query_embedding: queryVector,
          match_threshold: 0.1,
          match_count: 8,
          filter_document_id: documentId,
        });

        const { data: introChunks } = await supabaseAdmin
          .from('document_chunks')
          .select('content, page_number')
          .eq('document_id', documentId)
          .order('page_number', { ascending: true })
          .limit(3);

        const combined = [...(matchedChunks || []), ...(introChunks || [])];
        const unique = Array.from(
          new Map(combined.map((item: any) => [item.id || item.content, item])).values(),
        );

        context = unique.map((c: any) => ({
          content: c.content,
          pageNumber: c.page_number || c.pageNumber,
          similarity: c.similarity || 0.8,
        }));
      }
    }

    const systemPrompt = buildSystemPrompt(docTitle, context);

    // 4. Safe conversational history truncation
    const trimmedHistory = messages.slice(-3).map((m: any) => ({
      role: m.role,
      content:
        m.role === 'assistant' && m.content.length > 500
          ? m.content.slice(0, 500) + '... [Previous context shortened]'
          : m.content,
    }));

    // 5. Stream response from Groq
    const stream = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'system', content: systemPrompt }, ...trimmedHistory],
      stream: true,
      temperature: 0.3,
      max_tokens: 2000,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
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
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
