import "server-only";
import { buildPlan, diffSnapshots, type PlanTopic, type SnapshotEntry } from "@/lib/core/planner";
import type { MasteryState, TaskActivity } from "@/lib/core/types";
import type { Supabase } from "@/lib/supabase/server";
import { logActivity, type Workspace } from "./auth";
import { check, checkMaybe, HttpError } from "./http";

interface TopicRow {
  id: string;
  name: string;
  importance: number;
  topic_mastery: { state: MasteryState; score: number; n_questions: number } | null;
  topic_chunks: { chunk_id: string }[];
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Deterministic plan (re)generation. Completed tasks from the previous plan are carried
 * forward unchanged, and the plan records why it changed relative to the previous one.
 */
export async function generatePlan(supabase: Supabase, ws: Workspace) {
  const topics = check(
    await supabase
      .from("topics")
      .select("id, name, importance, topic_mastery(state, score, n_questions), topic_chunks(chunk_id)")
      .eq("workspace_id", ws.id),
    "Load topics",
  ) as unknown as TopicRow[];
  if (!topics.length) throw new HttpError(422, "Build the topic map before generating a plan.");

  const prev = checkMaybe(
    await supabase
      .from("revision_plans")
      .select("id, version, snapshot")
      .eq("workspace_id", ws.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "Load plan",
  );
  const prevDone = prev
    ? (check(
        await supabase
          .from("revision_tasks")
          .select("topic_id, topic_name, activity, priority, minutes, reason, source_chunk_ids, due_date, done_at")
          .eq("plan_id", prev.id)
          .eq("done", true),
        "Load tasks",
      ) as { topic_id: string | null; topic_name: string; activity: TaskActivity; priority: number; minutes: number; reason: string; source_chunk_ids: string[]; due_date: string; done_at: string }[])
    : [];

  const planTopics: PlanTopic[] = topics.map((t) => ({
    id: t.id,
    name: t.name,
    importance: t.importance,
    state: t.topic_mastery?.state ?? "not_assessed",
    score: Number(t.topic_mastery?.score ?? 0),
    n_questions: t.topic_mastery?.n_questions ?? 0,
    source_chunk_ids: t.topic_chunks.map((c) => c.chunk_id),
  }));
  const snapshot: SnapshotEntry[] = planTopics.map((t) => ({
    topic_id: t.id, name: t.name, state: t.state, score: t.score, n_questions: t.n_questions,
  }));
  const previous = (prev?.snapshot ?? []) as SnapshotEntry[];

  const today = todayISO();
  const { tasks, unscheduled, budgetMinutes } = buildPlan({
    topics: planTopics,
    today,
    examDate: ws.exam_date,
    hoursPerDay: ws.hours_per_day,
    done: prevDone.map((d) => ({ topic_id: d.topic_id, activity: d.activity })),
    previous,
  });

  const summary = diffSnapshots(previous, snapshot);
  if (prevDone.length) summary.push(`Kept ${prevDone.length} completed task${prevDone.length === 1 ? "" : "s"} from the previous plan.`);
  if (unscheduled.length) summary.push(`${unscheduled.length} task(s) did not fit your time budget — consider adding study hours.`);

  const plan = check(
    await supabase
      .from("revision_plans")
      .insert({
        workspace_id: ws.id,
        version: (prev?.version ?? 0) + 1,
        budget_minutes: budgetMinutes,
        change_summary: summary,
        unscheduled,
        snapshot,
      })
      .select("id, version")
      .single(),
    "Create plan",
  );

  // Rows must share one shape: PostgREST bulk inserts NULL-fill missing keys.
  const rows = [
    ...prevDone.map((d) => ({ ...d, workspace_id: ws.id, plan_id: plan.id, done: true })),
    ...tasks.map((t) => ({ ...t, workspace_id: ws.id, plan_id: plan.id, done: false, done_at: null })),
  ];
  if (rows.length) checkMaybe(await supabase.from("revision_tasks").insert(rows, { defaultToNull: false }), "Save tasks");
  await logActivity(supabase, ws.id, "plan_generated", `Revision plan v${plan.version} generated`);
  return { plan_id: plan.id, version: plan.version, change_summary: summary, task_count: tasks.length };
}
