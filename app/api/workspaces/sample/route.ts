import { addDays } from "@/lib/core/planner";
import { SAMPLE_DOCUMENTS, SAMPLE_WORKSPACE } from "@/lib/sample/content";
import { logActivity, requireApiUser } from "@/lib/services/auth";
import { check, handle } from "@/lib/services/http";
import { processDocument } from "@/lib/services/ingest";
import { todayISO } from "@/lib/services/plan";
import { enforceRateLimit } from "@/lib/services/rateLimit";
import { extractTopics } from "@/lib/services/topics";

export const maxDuration = 60;

/**
 * Creates a clearly labelled sample workspace and runs the REAL pipeline on the sample
 * notes (upload → extract → chunk → embed → topic map). No results are pre-seeded.
 */
export async function POST() {
  return handle(async () => {
    const { supabase, userId } = await requireApiUser();
    await enforceRateLimit(supabase, "sample");

    const ws = check(
      await supabase
        .from("workspaces")
        .insert({
          name: SAMPLE_WORKSPACE.name,
          subject: SAMPLE_WORKSPACE.subject,
          hours_per_day: SAMPLE_WORKSPACE.hours_per_day,
          exam_date: addDays(todayISO(), SAMPLE_WORKSPACE.examInDays),
          is_sample: true,
        })
        .select("id")
        .single(),
      "Create workspace",
    );

    const failures: string[] = [];
    for (const d of SAMPLE_DOCUMENTS) {
      const path = `${userId}/${ws.id}/${crypto.randomUUID()}-${d.filename}`;
      const bytes = new TextEncoder().encode(d.content);
      const up = await supabase.storage.from("documents").upload(path, bytes, { contentType: d.mime });
      if (up.error) {
        console.error("[sample] upload", up.error.message);
        failures.push(`${d.title}: storage upload failed`);
        continue;
      }
      const doc = check(
        await supabase
          .from("documents")
          .insert({ workspace_id: ws.id, title: d.title, storage_path: path, mime: d.mime, size_bytes: bytes.length, is_sample: true })
          .select("id")
          .single(),
        "Create document",
      );
      const res = await processDocument(supabase, doc.id);
      if (res.status === "failed") failures.push(`${d.title}: ${res.error}`);
    }

    let topicsError: string | null = null;
    if (failures.length < SAMPLE_DOCUMENTS.length) {
      try {
        await extractTopics(supabase, ws.id);
      } catch (e) {
        topicsError = e instanceof Error ? e.message : "Topic extraction failed";
      }
    }
    await logActivity(supabase, ws.id, "sample_opened", "Opened the sample workspace");
    return { workspace_id: ws.id, failures, topics_error: topicsError };
  });
}
