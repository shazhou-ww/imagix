import { z } from "zod";

export const GenerateStoryRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  genre: z
    .enum(["fantasy", "sci-fi", "romance", "mystery", "adventure"])
    .optional(),
});

export const GenerateStoryResponseSchema = z.object({
  id: z.string(),
  content: z.string(),
  prompt: z.string(),
  createdAt: z.string(),
});

export const GetStoryRequestSchema = z.object({
  id: z.string(),
});

export const StorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  prompt: z.string(),
  content: z.string(),
  genre: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GenerateStoryRequest = z.infer<typeof GenerateStoryRequestSchema>;
export type GenerateStoryResponse = z.infer<typeof GenerateStoryResponseSchema>;
export type GetStoryRequest = z.infer<typeof GetStoryRequestSchema>;
export type Story = z.infer<typeof StorySchema>;
