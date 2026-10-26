import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { loadWorkspacePage } from "@/lib/services/pages";
import { DocumentManager, type DocRow } from "./document-manager";

export const metadata: Metadata = { title: "My Materials" };

export default async function MaterialsPage({ params }: PageProps<"/w/[wid]/documents">) {
  const { supabase, ws } = await loadWorkspacePage(params);
  const [{ data: docs }, { count: topicCount }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, storage_path, mime, size_bytes, status, error, page_count, chunk_count, is_sample, created_at")
      .eq("workspace_id", ws.id)
      .order("created_at", { ascending: false }),
    supabase.from("topics").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="My Materials"
        title="My Materials"
        description="Upload your notes and study materials to build your learning assessment."
      />
      <DocumentManager workspaceId={ws.id} initialDocs={(docs ?? []) as DocRow[]} hasTopics={(topicCount ?? 0) > 0} />
    </>
  );
}
