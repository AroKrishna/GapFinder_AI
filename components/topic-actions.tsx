"use client";

import { CalendarPlus, ListChecks, Loader2, Network } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

type Variant = "primary" | "secondary" | "soft" | "ghost";
type Size = "sm" | "md" | "lg";

/** Generates a quiz from the student's own material (optionally for specific topics) and opens it. */
export function GenerateQuizButton({
  workspaceId, topicIds, label = "Take a quick quiz", variant = "primary", size = "md", className,
}: { workspaceId: string; topicIds?: string[]; label?: string; variant?: Variant; size?: Size; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const res = await api<{ quiz_id: string; question_count: number; rejected_count: number }>(`/api/workspaces/${workspaceId}/quizzes`, {
        body: topicIds ? { topic_ids: topicIds } : {},
      });
      toast.success(`${res.question_count} questions ready, all from your material`);
      router.push(`/w/${workspaceId}/quiz/${res.quiz_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the quiz. Please try again.");
      setBusy(false);
    }
  }
  return (
    <Button variant={variant} size={size} onClick={go} disabled={busy} className={className} aria-busy={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <ListChecks />}
      {busy ? "Writing questions from your notes…" : label}
    </Button>
  );
}

export function BuildTopicsButton({
  workspaceId, rebuild, variant = "primary", size = "md", className,
}: { workspaceId: string; rebuild?: boolean; variant?: Variant; size?: Size; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const res = await api<{ topic_count: number }>(`/api/workspaces/${workspaceId}/topics`);
      toast.success(`Found ${res.topic_count} topics in your material`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't find topics. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant={variant} size={size} onClick={go} disabled={busy} className={className} aria-busy={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Network />}
      {busy ? "Reading your material…" : rebuild ? "Refresh topics" : "Find my topics"}
    </Button>
  );
}

export function GeneratePlanButton({
  workspaceId, label = "Make my revision plan", variant = "primary", size = "md", className, stay,
}: { workspaceId: string; label?: string; variant?: Variant; size?: Size; className?: string; stay?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const res = await api<{ version: number; task_count: number }>(`/api/workspaces/${workspaceId}/plan`);
      toast.success(res.version > 1 ? `Plan updated: ${res.task_count} tasks` : `Plan ready: ${res.task_count} tasks`);
      if (!stay) router.push(`/w/${workspaceId}/plan`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't build the plan. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant={variant} size={size} onClick={go} disabled={busy} className={className} aria-busy={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
      {label}
    </Button>
  );
}
