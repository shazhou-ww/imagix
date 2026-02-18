import { z } from "zod";

export const LoginRequestSchema = z.object({
  provider: z.enum(["google", "email"]),
  token: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().optional(),
});

export const LoginResponseSchema = z.object({
  success: z.boolean(),
  token: z.string().optional(),
  user: z
    .object({
      id: z.string(),
      email: z.string().email(),
      name: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
