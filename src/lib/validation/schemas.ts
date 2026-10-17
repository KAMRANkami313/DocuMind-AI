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
      }),
    )
    .optional(),
  createdAt: z.string().optional(),
});

export const chatRequestSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  messages: z.array(chatMessageSchema).min(1, 'At least one message is required').max(50),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;