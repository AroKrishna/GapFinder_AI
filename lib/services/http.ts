import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AiError } from "@/lib/ai/gemini";
import { ConfigError } from "@/lib/env";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`);

/** Wrap a route handler: consistent JSON errors, no stack traces or provider details leaked. */
export async function handle(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    const data = await fn();
    if (data instanceof NextResponse) return data;
    return NextResponse.json(data ?? { ok: true });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request", issues: e.issues.slice(0, 5).map((i) => i.message) }, { status: 400 });
    }
    if (e instanceof AiError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof ConfigError) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error("[api]", e);
    return NextResponse.json({ error: "Something went wrong. Please retry." }, { status: 500 });
  }
}

type DbResult<T> = { data: T; error: { message: string; code?: string } | null };

/** For `.maybeSingle()`: throw on Supabase errors with a safe message; null means "not found". */
export function checkMaybe<T>(res: DbResult<T>, what = "Database"): T {
  if (res.error) {
    console.error(`[db] ${what}:`, res.error.message);
    throw new HttpError(500, `${what} operation failed`);
  }
  return res.data;
}

/** Throw on Supabase errors (or a missing result) with a safe message. */
export function check<T>(res: DbResult<T>, what = "Database"): NonNullable<T> {
  const data = checkMaybe(res, what);
  if (data === null || data === undefined) throw new HttpError(500, `${what} returned no data`);
  return data;
}
