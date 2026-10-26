import { requireApiUser } from "@/lib/services/auth";
import { check, checkMaybe, handle, notFound } from "@/lib/services/http";
import { recomputeMastery } from "@/lib/services/quiz";
import { uuid } from "@/lib/services/validation";

export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  return handle(async () => {
    const { supabase } = await requireApiUser();
    const docId = uuid.parse((await ctx.params).id);
    const doc = checkMaybe(
      await supabase.from("documents").select("id, status, error, chunk_count").eq("id", docId).maybeSingle(),
      "Load document",
    );
    if (!doc) throw notFound("Document");
    return doc;
  });
}

/** Safe deletion: storage object, chunks (cascade), topic links (cascade), then refresh mastery. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  return handle(async () => {
    const { supabase } = await requireApiUser();
    const docId = uuid.parse((await ctx.params).id);
    const doc = checkMaybe(
      await supabase.from("documents").select("id, workspace_id, storage_path").eq("id", docId).maybeSingle(),
      "Load document",
    );
    if (!doc) throw notFound("Document");
    const removed = await supabase.storage.from("documents").remove([doc.storage_path]);
    if (removed.error) console.error("[storage] remove failed:", removed.error.message);
    else if (!removed.data?.length) console.warn("[storage] remove matched no object:", doc.storage_path.split("/").slice(1).join("/"));
    checkMaybe(await supabase.from("documents").delete().eq("id", doc.id), "Delete document");
    // Topics that lost every source passage are removed so the map never shows unsupported topics.
    const orphans = check(
      await supabase.from("topics").select("id, topic_chunks(chunk_id)").eq("workspace_id", doc.workspace_id),
      "Load topics",
    ) as { id: string; topic_chunks: unknown[] }[];
    const orphanIds = orphans.filter((t) => !t.topic_chunks.length).map((t) => t.id);
    if (orphanIds.length) await supabase.from("topics").delete().in("id", orphanIds);
    await recomputeMastery(supabase, doc.workspace_id, null);
    return { ok: true };
  });
}
