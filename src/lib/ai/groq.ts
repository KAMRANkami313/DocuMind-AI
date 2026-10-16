import Groq from 'groq-sdk';

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error('Missing GROQ_API_KEY environment variable.');
}

export const groq = new Groq({ apiKey });

export function buildSystemPrompt(contextChunks: { content: string; pageNumber: number }[]): string {
  const formattedContext = contextChunks
    .map((c, i) => `[Source ${i + 1} | Page ${c.pageNumber}]:\n${c.content}`)
    .join('\n\n');

  return `You are an expert, precise academic and technical document assistant.
Your task is to answer the user's question using ONLY the retrieved document sources below.

STRICT RULES:
1. Base your answer strictly on the provided sources. Do not extrapolate, assume, or invent facts.
2. If the answer cannot be found in the provided sources, explicitly reply:
   "I cannot find information regarding this in the uploaded document."
3. Always cite your sources inline using brackets like [Page X] whenever making a claim or referencing a fact.
4. Keep answers concise, factual, and well-structured using markdown.

CONTEXT SOURCES:
${formattedContext}`;
}