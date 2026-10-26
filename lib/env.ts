import { z } from "zod";

export class ConfigError extends Error {}

// NEXT_PUBLIC_* must be referenced literally so Next.js can inline them for the browser.
export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new ConfigError("Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const aiSchema = z.object({
  GEMINI_API_KEY: z.string().min(10),
  GEMINI_MODEL: z.string().default("gemini-flash-latest"),
  // Tried in order when the primary model is overloaded, rate-limited or times out.
  GEMINI_FALLBACK_MODELS: z
    .string()
    .default("gemini-flash-lite-latest")
    .transform((s) => s.split(",").map((m) => m.trim()).filter(Boolean)),
  GEMINI_EMBED_MODEL: z.string().default("gemini-embedding-001"),
});

/** Server-only AI configuration. Throws ConfigError with a readable message when missing. */
export function aiEnv() {
  const parsed = aiSchema.safeParse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL || undefined,
    GEMINI_FALLBACK_MODELS: process.env.GEMINI_FALLBACK_MODELS || undefined,
    GEMINI_EMBED_MODEL: process.env.GEMINI_EMBED_MODEL || undefined,
  });
  if (!parsed.success) throw new ConfigError("Gemini is not configured: set GEMINI_API_KEY on the server.");
  return parsed.data;
}
