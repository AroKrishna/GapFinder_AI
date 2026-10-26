import "server-only";
import type { Citation, MasteryState } from "@/lib/core/types";
import type { Supabase } from "@/lib/supabase/server";

export interface TopicView {
  id: string;
  name: string;
  summary: string;
  importance: number;
  parent_id: string | null;
  state: MasteryState;
  score: number;
  n_questions: number;
  n_correct: number;
  provisional: boolean;
  reasons: string[];
  sources: Citation[];
}

interface RawTopic {
  id: string;
  name: string;
  summary: string;
  importance: number;
  parent_id: string | null;
  topic_mastery: { state: MasteryState; score: number; n_questions: number; n_correct: number; provisional: boolean; reasons: string[] } | null;
  topic_chunks: { document_chunks: { id: string; content: string; page: number | null; heading: string | null; documents: { title: string } | null } | null }[];
}

export function excerpt(s: string, n = 280) {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

/** Topics with mastery and their linked source passages, ordered by importance then name. */
export async function getTopics(supabase: Supabase, workspaceId: string): Promise<TopicView[]> {
  const { data } = await supabase
    .from("topics")
    .select(
      "id, name, summary, importance, parent_id, topic_mastery(state, score, n_questions, n_correct, provisional, reasons), topic_chunks(document_chunks(id, content, page, heading, documents(title)))",
    )
    .eq("workspace_id", workspaceId)
    .order("importance", { ascending: false })
    .order("name");
  return ((data ?? []) as unknown as RawTopic[]).map((t) => ({
    id: t.id,
    name: t.name,
    summary: t.summary,
    importance: t.importance,
    parent_id: t.parent_id,
    state: t.topic_mastery?.state ?? "not_assessed",
    score: Number(t.topic_mastery?.score ?? 0),
    n_questions: t.topic_mastery?.n_questions ?? 0,
    n_correct: t.topic_mastery?.n_correct ?? 0,
    provisional: t.topic_mastery?.provisional ?? true,
    reasons: t.topic_mastery?.reasons ?? [],
    sources: t.topic_chunks
      .map((tc) => tc.document_chunks)
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => ({ chunk_id: c.id, document_title: c.documents?.title ?? "Document", page: c.page, heading: c.heading, excerpt: excerpt(c.content) })),
  }));
}

/** Resolve chunk ids to citations (RLS ensures only the caller's chunks come back). */
export async function getCitations(supabase: Supabase, chunkIds: string[]): Promise<Map<string, Citation>> {
  if (!chunkIds.length) return new Map();
  const { data } = await supabase
    .from("document_chunks")
    .select("id, content, page, heading, documents(title)")
    .in("id", Array.from(new Set(chunkIds)).slice(0, 200));
  const rows = (data ?? []) as unknown as { id: string; content: string; page: number | null; heading: string | null; documents: { title: string } | null }[];
  return new Map(
    rows.map((c) => [c.id, { chunk_id: c.id, document_title: c.documents?.title ?? "Document", page: c.page, heading: c.heading, excerpt: excerpt(c.content, 360) }]),
  );
}
