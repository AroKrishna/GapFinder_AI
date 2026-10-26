import { PLANNER } from "./config";
import type { MasteryState, TaskActivity } from "./types";

export interface PlanTopic {
  id: string;
  name: string;
  importance: number; // 1..3
  state: MasteryState;
  score: number;
  n_questions: number;
  source_chunk_ids: string[];
}

export interface DoneTask {
  topic_id: string | null;
  activity: TaskActivity;
}

export interface PlannedTask {
  topic_id: string;
  topic_name: string;
  activity: TaskActivity;
  minutes: number;
  priority: number;
  reason: string;
  source_chunk_ids: string[];
  due_date: string; // YYYY-MM-DD
}

export interface SnapshotEntry {
  topic_id: string;
  name: string;
  state: MasteryState;
  score: number;
  n_questions: number;
}

const TEMPLATES: Record<MasteryState, { activity: TaskActivity; minutes: number }[]> = {
  weak: [
    { activity: "read", minutes: 30 },
    { activity: "tutor", minutes: 10 },
    { activity: "practice", minutes: 15 },
  ],
  developing: [
    { activity: "read", minutes: 15 },
    { activity: "practice", minutes: 15 },
  ],
  not_assessed: [{ activity: "assess", minutes: 10 }],
  strong: [{ activity: "review", minutes: 10 }],
};

export const ACTIVITY_LABEL: Record<TaskActivity, string> = {
  read: "Re-read source passages",
  tutor: "Ask the tutor to explain",
  practice: "Practice quiz",
  assess: "Take a diagnostic quiz",
  review: "Quick review",
};

const IMPORTANCE_LABEL = ["", "lower-weight", "standard", "high-weight"];

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function priorityFor(t: PlanTopic, prev?: SnapshotEntry): number {
  let p = t.importance * PLANNER.gapWeight[t.state];
  if (t.state !== "not_assessed") p += (1 - t.score) * 0.5; // tie-break toward lower scores
  if (prev && prev.state !== "not_assessed" && t.n_questions > prev.n_questions && t.score < prev.score - 0.05) {
    p += PLANNER.declineBonus;
  }
  return Math.round(p * 1000) / 1000;
}

export function reasonFor(t: PlanTopic, prev?: SnapshotEntry): string {
  const imp = IMPORTANCE_LABEL[t.importance] ?? "standard";
  const declined = prev && t.n_questions > prev.n_questions && t.score < prev.score - 0.05 ? " Score dropped since last plan." : "";
  const answers = `${t.n_questions} answer${t.n_questions === 1 ? "" : "s"}`;
  switch (t.state) {
    case "weak":
      return `Needs practice: about ${pct(t.score)} from ${answers} on a ${imp} topic — top priority.${declined}`;
    case "developing":
      return `Developing: about ${pct(t.score)} from ${answers} — a little practice will make it solid.${declined}`;
    case "not_assessed":
      return `Not assessed yet (${answers} so far) — a short quiz will show where you stand.`;
    case "strong":
      return `Strong: about ${pct(t.score)} from ${answers} — a quick review is enough.`;
  }
}

/** Student-facing state names (match the UI badges). */
export const STATE_LABEL: Record<MasteryState, string> = {
  weak: "Needs practice",
  developing: "Developing",
  strong: "Strong",
  not_assessed: "Not assessed",
};

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysAvailable(today: string, examDate: string | null): number {
  if (!examDate) return PLANNER.horizonDays;
  const diff = Math.round((Date.parse(examDate) - Date.parse(today)) / 86_400_000);
  return Math.min(PLANNER.horizonDays, Math.max(1, diff));
}

/**
 * Deterministic, budget-respecting plan.
 * 1. Expand each topic into activity templates for its state.
 * 2. Skip activities already completed while the topic's state is unchanged.
 * 3. Sort by priority, then first-fit into days with hours_per_day capacity.
 * Anything that doesn't fit is returned as `unscheduled` — never silently dropped.
 */
export function buildPlan(input: {
  topics: PlanTopic[];
  today: string;
  examDate: string | null;
  hoursPerDay: number;
  done: DoneTask[];
  previous: SnapshotEntry[];
}): { tasks: PlannedTask[]; unscheduled: { topic_name: string; activity: TaskActivity; minutes: number }[]; budgetMinutes: number; days: number } {
  const days = daysAvailable(input.today, input.examDate);
  const daily = Math.round(input.hoursPerDay * 60);
  const prevById = new Map(input.previous.map((p) => [p.topic_id, p]));
  const doneKeys = new Set(input.done.map((d) => `${d.topic_id}:${d.activity}`));

  const candidates: Omit<PlannedTask, "due_date">[] = [];
  for (const t of input.topics) {
    const prev = prevById.get(t.id);
    const stateUnchanged = prev && prev.state === t.state && prev.n_questions === t.n_questions;
    const priority = priorityFor(t, prev);
    const reason = reasonFor(t, prev);
    for (const tpl of TEMPLATES[t.state]) {
      if (stateUnchanged && doneKeys.has(`${t.id}:${tpl.activity}`)) continue;
      candidates.push({
        topic_id: t.id,
        topic_name: t.name,
        activity: tpl.activity,
        minutes: tpl.minutes,
        priority,
        reason,
        source_chunk_ids: t.source_chunk_ids.slice(0, 4),
      });
    }
  }
  // Stable sort: priority desc, then keep template order within a topic.
  candidates.sort((a, b) => b.priority - a.priority);

  const remaining = Array.from({ length: days }, () => daily);
  const tasks: PlannedTask[] = [];
  const unscheduled: { topic_name: string; activity: TaskActivity; minutes: number }[] = [];
  const lastDayForTopic = new Map<string, number>();
  for (const c of candidates) {
    // Keep a topic's activities in order (read before practice): start at its last used day.
    const start = lastDayForTopic.get(c.topic_id) ?? 0;
    let placed = -1;
    for (let d = start; d < days; d++) {
      if (remaining[d] >= c.minutes) { placed = d; break; }
    }
    if (placed < 0) {
      unscheduled.push({ topic_name: c.topic_name, activity: c.activity, minutes: c.minutes });
      continue;
    }
    remaining[placed] -= c.minutes;
    lastDayForTopic.set(c.topic_id, placed);
    tasks.push({ ...c, due_date: addDays(input.today, placed) });
  }
  return { tasks, unscheduled, budgetMinutes: days * daily, days };
}

const STATE_RANK: Record<MasteryState, number> = { not_assessed: -1, weak: 0, developing: 1, strong: 2 };

/** Human-readable explanation of what changed since the previous plan. */
export function diffSnapshots(previous: SnapshotEntry[], current: SnapshotEntry[]): string[] {
  if (!previous.length) return ["First plan, built from your current topic results."];
  const prevById = new Map(previous.map((p) => [p.topic_id, p]));
  const L = STATE_LABEL;
  const out: string[] = [];
  for (const c of current) {
    const p = prevById.get(c.topic_id);
    if (!p) { out.push(`${c.name}: new topic added to the plan.`); continue; }
    if (p.state === c.state) {
      if (c.n_questions > p.n_questions && Math.abs(c.score - p.score) >= 0.05) {
        out.push(`${c.name}: still ${L[c.state].toLowerCase()}, ${pct(p.score)} → ${pct(c.score)}.`);
      }
      continue;
    }
    if (p.state === "not_assessed") out.push(`${c.name}: now assessed — ${L[c.state]} (${pct(c.score)}).`);
    else if (STATE_RANK[c.state] > STATE_RANK[p.state]) out.push(`${c.name}: improved from ${L[p.state]} to ${L[c.state]}, so it gets less time.`);
    else out.push(`${c.name}: dropped from ${L[p.state]} to ${L[c.state]}, so it gets more time.`);
  }
  if (!out.length) out.push("No changes in your topic results since the last plan; schedule refreshed from today.");
  return out;
}
