import "server-only";
import { embedQuery } from "@/lib/ai/gemini";
import { RETRIEVAL } from "@/lib/core/config";
import { boundContext, buildTsQuery } from "@/lib/core/query";
import type { RetrievedChunk } from "@/lib/core/types";
import type { Supabase } from "@/lib/supabase/server";
import { checkMaybe } from "./http";

/** Hybrid (vector + keyword, RRF-fused) retrieval scoped to one workspace; RLS limits it to the caller. */
export async function retrieveWithEmbedding(
  supabase: Supabase,
  workspaceId: string,
  embedding: number[],
  queryText: string,
  k: number = RETRIEVAL.topK,
): Promise<RetrievedChunk[]> {
  const rows = checkMaybe(
    await supabase.rpc("match_chunks", {
      p_workspace: workspaceId,
      p_embedding: JSON.stringify(embedding),
      p_query: buildTsQuery(queryText),
      p_k: k,
    }),
    "Retrieval",
  ) as RetrievedChunk[] | null;
  return boundContext(rows ?? []);
}

export async function retrieve(supabase: Supabase, workspaceId: string, query: string, k?: number) {
  const embedding = await embedQuery(query);
  return retrieveWithEmbedding(supabase, workspaceId, embedding, query, k);
}
