import "server-only";
import { RATE_LIMITS } from "@/lib/core/config";
import type { Supabase } from "@/lib/supabase/server";
import { HttpError } from "./http";

/**
 * Best-effort per-user hourly limit for expensive AI endpoints, backed by Postgres
 * (works across serverless instances). Not a hard guarantee under heavy concurrency.
 */
export async function enforceRateLimit(supabase: Supabase, endpoint: keyof typeof RATE_LIMITS & string) {
  const limit = RATE_LIMITS[endpoint] ?? 20;
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("endpoint", endpoint)
    .gte("created_at", since);
  if ((count ?? 0) >= limit) {
    throw new HttpError(429, `Hourly limit reached for this AI action (${limit}/hour). Please try again later.`);
  }
  await supabase.from("ai_usage").insert({ endpoint });
}
