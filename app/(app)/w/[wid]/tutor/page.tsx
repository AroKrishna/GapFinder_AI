import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import type { Citation } from "@/lib/core/types";
import { loadWorkspacePage } from "@/lib/services/pages";
import { TutorChat, type ChatMessage } from "./tutor-chat";

export const metadata: Metadata = { title: "Ask AI Tutor" };

export default async function TutorPage({ params, searchParams }: PageProps<"/w/[wid]/tutor">) {
  const { supabase, ws } = await loadWorkspacePage(params);
  const sp = await searchParams;
  const [{ data: topics }, { data: history }, { count: chunkCount }] = await Promise.all([
    supabase.from("topics").select("id, name").eq("workspace_id", ws.id).order("name"),
    supabase
      .from("tutor_messages")
      .select("id, role, content, citations, insufficient_evidence, created_at")
      .eq("workspace_id", ws.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("document_chunks").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
  ]);

  // Oldest first; when a question and its answer share a timestamp, the question comes first.
  const ordered = [...(history ?? [])].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || (a.role === "user" ? -1 : b.role === "user" ? 1 : 0),
  );
  const initial: ChatMessage[] = ordered.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    citations: (m.citations ?? []) as Citation[],
    insufficient: m.insufficient_evidence,
  }));
  const topicParam = typeof sp.topic === "string" ? sp.topic : null;

  return (
    <>
      <PageHeader
        eyebrow="Ask AI Tutor"
        title="Ask AI Tutor"
        description="Ask questions grounded strictly in your uploaded study materials. Every explanation references numbered source passages, and the tutor acknowledges when notes do not cover a topic."
      />
      <TutorChat
        workspaceId={ws.id}
        topics={topics ?? []}
        initialTopic={topics?.some((t) => t.id === topicParam) ? topicParam : null}
        initialMessages={initial}
        hasMaterial={(chunkCount ?? 0) > 0}
      />
    </>
  );
}
