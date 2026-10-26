import { describe, expect, it } from "vitest";
import { buildPlan, daysAvailable, diffSnapshots, type PlanTopic, type SnapshotEntry } from "@/lib/core/planner";

const topic = (id: string, state: PlanTopic["state"], opts: Partial<PlanTopic> = {}): PlanTopic => ({
  id, name: id.toUpperCase(), importance: 2, state, score: state === "weak" ? 0.3 : state === "developing" ? 0.6 : state === "strong" ? 0.9 : 0, n_questions: state === "not_assessed" ? 0 : 3, source_chunk_ids: ["c-" + id], ...opts,
});
const today = "2026-10-26";

describe("daysAvailable", () => {
  it("caps the horizon and never goes below one day", () => {
    expect(daysAvailable(today, "2026-10-29")).toBe(3);
    expect(daysAvailable(today, "2027-03-01")).toBe(14);
    expect(daysAvailable(today, "2026-10-01")).toBe(1);
    expect(daysAvailable(today, null)).toBe(14);
  });
});

describe("buildPlan", () => {
  it("prioritises weak topics and never exceeds the daily budget", () => {
    const { tasks, budgetMinutes } = buildPlan({
      topics: [topic("s", "strong"), topic("w", "weak"), topic("d", "developing"), topic("n", "not_assessed")],
      today, examDate: "2026-10-28", hoursPerDay: 1, done: [], previous: [],
    });
    expect(budgetMinutes).toBe(120);
    expect(tasks[0].topic_id).toBe("w");
    const perDay = new Map<string, number>();
    for (const t of tasks) perDay.set(t.due_date, (perDay.get(t.due_date) ?? 0) + t.minutes);
    for (const m of perDay.values()) expect(m).toBeLessThanOrEqual(60);
    expect(tasks.every((t) => t.reason.length > 10)).toBe(true);
  });

  it("reports what doesn't fit instead of overbooking", () => {
    const topics = Array.from({ length: 8 }, (_, i) => topic("w" + i, "weak"));
    const { tasks, unscheduled } = buildPlan({ topics, today, examDate: "2026-10-27", hoursPerDay: 1, done: [], previous: [] });
    expect(tasks.reduce((s, t) => s + t.minutes, 0)).toBeLessThanOrEqual(60);
    expect(unscheduled.length).toBeGreaterThan(0);
  });

  it("keeps a topic's activities in order (read before practice)", () => {
    const { tasks } = buildPlan({ topics: [topic("w", "weak")], today, examDate: null, hoursPerDay: 0.5, done: [], previous: [] });
    const days = tasks.map((t) => [t.activity, t.due_date]);
    expect(days[0][0]).toBe("read");
    expect(tasks.map((t) => t.due_date)).toEqual([...tasks.map((t) => t.due_date)].sort());
  });

  it("skips completed activities when the topic's state is unchanged, but re-adds them after new evidence", () => {
    const w = topic("w", "weak");
    const prev: SnapshotEntry[] = [{ topic_id: "w", name: "W", state: "weak", score: 0.3, n_questions: 3 }];
    const same = buildPlan({ topics: [w], today, examDate: null, hoursPerDay: 2, done: [{ topic_id: "w", activity: "read" }], previous: prev });
    expect(same.tasks.some((t) => t.activity === "read")).toBe(false);
    const moreEvidence = buildPlan({ topics: [{ ...w, n_questions: 5 }], today, examDate: null, hoursPerDay: 2, done: [{ topic_id: "w", activity: "read" }], previous: prev });
    expect(moreEvidence.tasks.some((t) => t.activity === "read")).toBe(true);
  });

  it("boosts topics whose score declined", () => {
    const prev: SnapshotEntry[] = [{ topic_id: "a", name: "A", state: "developing", score: 0.7, n_questions: 3 }];
    const { tasks } = buildPlan({
      topics: [topic("a", "developing", { score: 0.55, n_questions: 6 }), topic("b", "developing", { score: 0.55, n_questions: 3 })],
      today, examDate: null, hoursPerDay: 3, done: [], previous: prev,
    });
    expect(tasks[0].topic_id).toBe("a");
    expect(tasks[0].reason).toMatch(/dropped/);
  });
});

describe("diffSnapshots", () => {
  it("explains state changes", () => {
    const prev: SnapshotEntry[] = [
      { topic_id: "a", name: "Deadlocks", state: "weak", score: 0.3, n_questions: 3 },
      { topic_id: "b", name: "Paging", state: "not_assessed", score: 0, n_questions: 0 },
      { topic_id: "c", name: "RR", state: "strong", score: 0.8, n_questions: 3 },
    ];
    const cur: SnapshotEntry[] = [
      { topic_id: "a", name: "Deadlocks", state: "developing", score: 0.6, n_questions: 6 },
      { topic_id: "b", name: "Paging", state: "weak", score: 0.25, n_questions: 2 },
      { topic_id: "c", name: "RR", state: "developing", score: 0.6, n_questions: 5 },
    ];
    const out = diffSnapshots(prev, cur).join("\n");
    expect(out).toMatch(/Deadlocks: improved from Needs practice to Developing/);
    expect(out).toMatch(/Paging: now assessed — Needs practice/);
    expect(out).toMatch(/RR: dropped from Strong to Developing/);
  });
  it("describes the first plan", () => {
    expect(diffSnapshots([], [])[0]).toMatch(/First plan/);
  });
});
