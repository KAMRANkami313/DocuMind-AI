import Groq from 'groq-sdk';

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error('Missing GROQ_API_KEY environment variable.');
}

export const groq = new Groq({ apiKey });

export function buildSystemPrompt(
  documentTitle: string,
  contextChunks: { content: string; pageNumber: number }[],
): string {
  const sorted = [...contextChunks].sort((a, b) => a.pageNumber - b.pageNumber);

  const formattedContext =
    sorted.length > 0
      ? sorted.map((c) => `[PAGE/SLIDE ${c.pageNumber}]:\n${c.content}`).join('\n\n')
      : 'NO RELEVANT TEXT FOUND.';

  return `You are a courteous, expert document intelligence assistant analyzing: "${documentTitle}".

YOUR CORE RESPONSIBILITIES:
1. Grounding: Answer accurately using the facts, definitions, and code in the DOCUMENT CONTEXT below.
2. Citations: Reference sources cleanly using inline [Page X] tags.
3. Handling Unrelated / Missing Topics with Grace:
   - If the user asks about an external topic not in the document (e.g. asking about cricket in a deep learning lab, or national debt in marketing slides):
     Do NOT be harsh or robotic. Politely inform the user what the active document is about, and gracefully explain that the requested topic is not covered in "${documentTitle}".
4. Proactive Follow-up Suggestions:
   - At the VERY END of every response, suggest exactly 3 relevant, interesting questions that the user might want to explore next based on the document.
   - Format them strictly at the end with this exact separator:
     <<<SUGGESTIONS>>>
     - [Short relevant question 1]
     - [Short relevant question 2]
     - [Short relevant question 3]

DOCUMENT CONTEXT:
${formattedContext}`;
}
