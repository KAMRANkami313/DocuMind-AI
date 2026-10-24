import { z } from 'zod';

export const chatMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(10_000),
  citations: z
    .array(
      z.object({
        chunkId: z.string().optional(),
        pageNumber: z.number().int().positive().optional(),
        excerpt: z.string().optional(),
        similarity: z.number().min(0).max(1).optional(),
        documentTitle: z.string().optional(),
      }),
    )
    .optional(),
  createdAt: z.string().optional(),
});

export const chatRequestSchema = z.object({
  // Accept either a real UUID (auth mode) or a client-generated guest ID
  // (e.g. "guest-session_<uuid>"). UUID-only validation breaks guest mode
  // because crypto.randomUUID() is wrapped with a prefix by generateId().
  chatSessionId: z.string().min(1).max(100, 'Invalid chat session ID'),
  messages: z.array(chatMessageSchema).min(1, 'At least one message is required').max(50),
  // Guest-mode only: when the client is unauthenticated, the chat_sessions
  // row doesn't exist in Postgres, so the client passes the attached document
  // IDs directly and the server retrieves context from them.
  documentIds: z.array(z.string().uuid()).max(3).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;