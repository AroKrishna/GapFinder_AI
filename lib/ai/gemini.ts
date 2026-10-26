import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import { INGEST } from "@/lib/core/config";
import { aiEnv } from "@/lib/env";

export const EMBED_DIM = 768;

/** Whole-operation budget; keeps every AI route inside Vercel's 60 s maxDuration. */
const GENERATION_BUDGET_MS = 48_000;
const CALL_TIMEOUT_MS = 25_000;
const EMBED_TIMEOUT_MS = 20_000;
/** After a model reports overload, prefer the fallback for this long (per warm instance). */
const COOLDOWN_MS = 60_000;

export class AiError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

let client: GoogleGenAI | null = null;
function ai() {
  // The SDK's default is 5 attempts with up to 60 s backoff — far beyond a serverless
  // budget. We make one attempt per call and handle retry/fallback ourselves.
  if (!client) client = new GoogleGenAI({ apiKey: aiEnv().GEMINI_API_KEY, httpOptions: { retryOptions: { attempts: 1 } } });
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const statusOf = (e: unknown) => (e instanceof ApiError ? e.status : 0);
/** Overload, rate limit, retired model or timeout/network: worth trying another model. */
const isTransient = (e: unknown) => {
  const s = statusOf(e);
  return s === 0 || s === 429 || s === 404 || s >= 500;
};

const cooldown = new Map<string, number>();

/** Primary model first, then fallbacks; models that recently failed go to the back. */
export function modelOrder(primary: string, fallbacks: string[], now = Date.now(), cooling = cooldown): string[] {
  const all = Array.from(new Set([primary, ...fallbacks].filter(Boolean)));
  const ready = all.filter((m) => (cooling.get(m) ?? 0) <= now);
  const cool = all.filter((m) => (cooling.get(m) ?? 0) > now);
  return [...ready, ...cool];
}

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  const status = statusOf(e);
  if (status === 429) return new AiError("The AI provider is rate-limiting requests. Please wait a minute and retry.", 429);
  if (status === 400 || status === 401 || status === 403) {
    return new AiError("The AI provider rejected the request (check GEMINI_API_KEY / model name).", 502);
  }
  if (status === 404) return new AiError("The configured Gemini model is not available (check GEMINI_MODEL).", 502);
  return new AiError("The AI provider is busy or unavailable right now. Please retry in a moment.", 503);
}

function l2normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export async function embedTexts(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
  const { GEMINI_EMBED_MODEL } = aiEnv();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += INGEST.embedBatch) {
    const batch = texts.slice(i, i + INGEST.embedBatch);
    const call = () =>
      ai().models.embedContent({
        model: GEMINI_EMBED_MODEL,
        contents: batch,
        config: { taskType, outputDimensionality: EMBED_DIM, httpOptions: { timeout: EMBED_TIMEOUT_MS } },
      });
    let res;
    try {
      res = await call();
    } catch (e) {
      if (!isTransient(e) || statusOf(e) === 404) throw logAndWrap(e, GEMINI_EMBED_MODEL);
      await sleep(statusOf(e) === 429 ? 3000 : 1000);
      try {
        res = await call();
      } catch (e2) {
        throw logAndWrap(e2, GEMINI_EMBED_MODEL);
      }
    }
    const vectors = res.embeddings?.map((e) => e.values ?? []) ?? [];
    if (vectors.length !== batch.length || vectors.some((v) => v.length !== EMBED_DIM)) {
      throw new AiError("Embedding response had an unexpected shape.");
    }
    out.push(...vectors.map(l2normalize));
  }
  return out;
}

function logAndWrap(e: unknown, model: string): AiError {
  console.error(`[gemini] ${model}:`, statusOf(e) || "", e instanceof Error ? e.message.slice(0, 200) : e);
  return toAiError(e);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text.slice(0, 2000)], "RETRIEVAL_QUERY");
  return v;
}

/**
 * Structured generation: JSON mode with a response schema, then strict Zod parsing.
 * Bounded by a total time budget. On overload/rate-limit/timeout it falls back to the
 * next configured model; on malformed output it regenerates once.
 */
export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  jsonSchema: object;
  schema: z.ZodType<T>;
  temperature?: number;
}): Promise<T> {
  const { GEMINI_MODEL, GEMINI_FALLBACK_MODELS } = aiEnv();
  const deadline = Date.now() + GENERATION_BUDGET_MS;
  const models = modelOrder(GEMINI_MODEL, GEMINI_FALLBACK_MODELS);
  let lastError: unknown = null;
  let malformed = 0;

  for (let m = 0; m < models.length && Date.now() < deadline - 3000; ) {
    const model = models[m];
    const timeout = Math.min(CALL_TIMEOUT_MS, deadline - Date.now());
    try {
      const res = await ai().models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          responseJsonSchema: opts.jsonSchema,
          temperature: opts.temperature ?? 0.3,
          maxOutputTokens: 8192,
          httpOptions: { timeout },
        },
      });
      const text = res.text ?? "";
      try {
        const parsed = opts.schema.safeParse(JSON.parse(text));
        if (parsed.success) return parsed.data;
        console.warn(`[gemini] ${model} schema mismatch`, parsed.error.issues.slice(0, 3));
      } catch {
        console.warn(`[gemini] ${model} non-JSON output`, text.slice(0, 200));
      }
      if (++malformed >= 2) throw new AiError("The AI returned malformed output twice. Please retry.");
      // Regenerate once with the same model.
    } catch (e) {
      if (e instanceof AiError) throw e;
      lastError = e;
      console.warn(`[gemini] ${model} failed:`, statusOf(e) || "timeout/network", e instanceof Error ? e.message.slice(0, 120) : "");
      if (!isTransient(e)) throw toAiError(e);
      cooldown.set(model, Date.now() + COOLDOWN_MS);
      m++;
      if (statusOf(e) === 429) await sleep(1000);
    }
  }
  throw toAiError(lastError);
}
