import "server-only";
import { generateJson } from "@/lib/ai/gemini";
import { passageBlock, TOPICS_SYSTEM } from "@/lib/ai/prompts";
import { topicsJsonSchema, topicsOut } from "@/lib/ai/schemas";
import { normalizeForMatch } from "@/lib/core/citations";
import type { Supabase } from "@/lib/supabase/server";
import { check, checkMaybe, HttpError } from "./http";

const MAX_SAMPLE = 40;

interface ChunkRow {
  id: string;
  content: string;
  page: number | null;
  heading: string | null;
  documents: { title: string } | null;
}

/** Evenly sample up to n items so long documents are represented end to end. */
export function evenSample<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]);
}

/**
 * Builds a source-linked topic map. The model may only reference passage labels it was
 * shown; topics with no valid label are discarded, so every topic links to real text.
 * Existing topics (and their mastery history) are kept and merged by name.
 */
export async function extractTopics(supabase: Supabase, workspaceId: string) {
  const rows = check(
    await supabase
      .from("document_chunks")
      .select("id, content, page, heading, documents(title)")
      .eq("workspace_id", workspaceId)
      .order("document_id")
      .order("idx")
      .limit(1000),
    "Load chunks",
  ) as unknown as ChunkRow[];
  if (!rows.length) throw new HttpError(422, "No processed documents yet. Upload material or open the sample workspace first.");

  const sample = evenSample(rows, MAX_SAMPLE);
  const labels = new Map(sample.map((c, i) => [`C${i + 1}`, c]));
  const prompt =
    `Passages from the student's material (excerpts):\n\n` +
    sample
      .map((c, i) =>
        passageBlock(`C${i + 1}`, {
          document_title: c.documents?.title ?? "Document",
          page: c.page,
          heading: c.heading,
          content: c.content.slice(0, 450),
        }),
      )
      .join("\n\n") +
    `\n\nReturn the topic map as JSON.`;

  const out = await generateJson({ system: TOPICS_SYSTEM, prompt, jsonSchema: topicsJsonSchema, schema: topicsOut });

  const seen = new Set<string>();
  const accepted = out.topics
    .map((t) => ({
      ...t,
      name: t.name.trim().replace(/\s+/g, " "),
      chunkIds: Array.from(new Set(t.source_labels.map((l) => labels.get(l.trim().toUpperCase())?.id).filter(Boolean) as string[])),
    }))
    .filter((t) => {
      const key = normalizeForMatch(t.name);
      if (!key || seen.has(key) || !t.chunkIds.length) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
  if (!accepted.length) throw new HttpError(422, "Could not identify source-backed topics in this material.");

  const upserted = check(
    await supabase
      .from("topics")
      .upsert(
        accepted.map((t) => ({ workspace_id: workspaceId, name: t.name, summary: t.summary, importance: t.importance })),
        { onConflict: "workspace_id,name" },
      )
      .select("id, name"),
    "Save topics",
  ) as { id: string; name: string }[];
  const idByName = new Map(upserted.map((t) => [t.name, t.id]));

  // Parent links (only to topics in this result set, never self).
  for (const t of accepted) {
    const parentId = t.parent ? idByName.get(t.parent.trim()) : undefined;
    const id = idByName.get(t.name);
    if (id && parentId && parentId !== id) await supabase.from("topics").update({ parent_id: parentId }).eq("id", id);
  }

  const links = accepted.flatMap((t) => t.chunkIds.map((chunk_id) => ({ topic_id: idByName.get(t.name)!, chunk_id })));
  checkMaybe(await supabase.from("topic_chunks").upsert(links, { onConflict: "topic_id,chunk_id", ignoreDuplicates: true }), "Link topics");

  return { topic_count: accepted.length, discarded: out.topics.length - accepted.length };
}
