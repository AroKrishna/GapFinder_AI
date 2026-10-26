import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock, FileText, Sparkles, Target, TrendingDown, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MasteryBadge, MasteryMix, SampleBadge, StatusPill, type DocStatus } from "@/components/badges";
import { ScoreTrend } from "@/components/charts";
import { FocusActionButton } from "@/components/focus-action";
import { Card, Progress, SectionTitle } from "@/components/ui/primitives";
import { ACTIVITY_LABEL } from "@/lib/core/planner";
import type { MasteryState, TaskActivity } from "@/lib/core/types";
import { pickFocus } from "@/lib/services/focus";
import { loadWorkspacePage } from "@/lib/services/pages";
import { todayISO } from "@/lib/services/plan";
import { getDisplayName } from "@/lib/services/profile";
import { getTopics } from "@/lib/services/queries";
import { examCountdown, formatDate, greeting, minutesLabel, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Home" };

interface TaskRow {
  id: string;
  topic_id: string | null;
  topic_name: string;
  activity: TaskActivity;
  minutes: number;
  reason: string;
  due_date: string;
  done: boolean;
}

export default async function Home({ params }: PageProps<"/w/[wid]">) {
  const { supabase, ws, userId } = await loadWorkspacePage(params);
  const { data: claims } = await supabase.auth.getClaims();
  const [name, topics, docsRes, quizzesRes, planRes] = await Promise.all([
    getDisplayName(supabase, userId, (claims?.claims?.email as string | undefined) ?? null),
    getTopics(supabase, ws.id),
    supabase.from("documents").select("id, title, status, chunk_count, created_at").eq("workspace_id", ws.id).order("created_at", { ascending: false }),
    supabase.from("quizzes").select("id, status, score, correct_count, question_count, submitted_at, created_at").eq("workspace_id", ws.id).order("created_at"),
    supabase.from("revision_plans").select("id, version").eq("workspace_id", ws.id).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const docs = docsRes.data ?? [];
  const quizzes = quizzesRes.data ?? [];
  const submitted = quizzes.filter((q) => q.status === "submitted");
  const pending = quizzes.filter((q) => q.status === "ready").at(-1) ?? null;
  const plan = planRes.data;
  const tasks: TaskRow[] = plan
    ? (((await supabase.from("revision_tasks").select("id, topic_id, topic_name, activity, minutes, reason, due_date, done").eq("plan_id", plan.id).order("due_date").order("priority", { ascending: false })).data ?? []) as TaskRow[])
    : [];

  const today = todayISO();
  const dueNow = tasks.filter((t) => t.due_date <= today);
  const todayDone = dueNow.filter((t) => t.done).length;
  const nextTask = tasks.find((t) => !t.done && t.due_date <= today) ?? null;
  const allDone = tasks.filter((t) => t.done).length;

  const counts = { weak: 0, developing: 0, strong: 0, not_assessed: 0 } as Record<MasteryState, number>;
  for (const t of topics) counts[t.state]++;
  const attention = [...topics]
    .filter((t) => t.state === "weak" || t.state === "developing")
    .sort((a, b) => (a.state === b.state ? a.score - b.score : a.state === "weak" ? -1 : 1))
    .slice(0, 3);
  const readyDocs = docs.filter((d) => d.status === "ready").length;

  const focus = pickFocus({
    readyDocs,
    topicCount: topics.length,
    pendingQuizId: pending?.id ?? null,
    pendingQuizSize: pending?.question_count ?? 0,
    submittedQuizzes: submitted.length,
    hasPlan: !!plan,
    nextTask,
    weakest: attention[0] ?? null,
  });

  const trend = submitted.map((q, i) => ({
    label: `Quiz ${i + 1}`,
    score: Math.round(Number(q.score) * 100),
    detail: `${q.correct_count}/${q.question_count} correct · ${formatDate(q.submitted_at)}`,
  }));
  const delta = trend.length >= 2 ? trend[trend.length - 1].score - trend[0].score : null;

  return (
    <div className="space-y-6">
      {/* 1. Welcome header */}
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-faint">{greeting()}, {name.split(" ")[0]}</p>
        <h1 className="text-2xl font-semibold leading-tight text-ink sm:text-[28px]">
          Today&apos;s Learning Dashboard
        </h1>
        <p className="text-sm text-muted">Review your learning gaps, follow your revision tasks, and test your understanding.</p>
      </header>

      {/* 2. Focus next (prominent recommendation panel) + Current Subject context */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-[var(--radius-card)] border border-brand-border bg-brand-soft p-5 sm:p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-brand">
            <Sparkles className="size-3.5" aria-hidden /> Recommended next action
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink sm:text-[22px]">{focus.title}</h2>
          <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted">{focus.why}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <FocusActionButton action={focus.action} workspaceId={ws.id} />
            {nextTask && focus.action.kind === "task" && (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <Clock className="size-3.5" aria-hidden /> Approx. {nextTask.minutes} min
              </span>
            )}
          </div>
        </div>

        <Card className="flex flex-col p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-faint">Subject</span>
            {ws.is_sample && <SampleBadge />}
          </div>
          <div className="mt-2 text-base font-semibold leading-snug text-ink">{ws.name}</div>
          {ws.subject && <div className="text-xs text-muted">{ws.subject}</div>}
          <dl className="mt-4 space-y-2 text-xs text-muted">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-faint" aria-hidden />
              <dt className="sr-only">Exam date</dt>
              <dd>{examCountdown(ws.exam_date)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 text-faint" aria-hidden />
              <dt className="sr-only">Target study hours</dt>
              <dd>{ws.hours_per_day} hours/day scheduled</dd>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="size-3.5 text-faint" aria-hidden />
              <dt className="sr-only">Materials summary</dt>
              <dd>{readyDocs} material{readyDocs === 1 ? "" : "s"} · {topics.length} topics</dd>
            </div>
          </dl>
          <Link href={`/w/${ws.id}/settings`} className="mt-auto pt-4 text-xs font-medium text-brand hover:text-brand-hover">
            Manage subject settings →
          </Link>
        </Card>
      </div>

      {/* 3. Learning overview + Today's revision */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle
            title="Learning Overview"
            hint={topics.length ? "Based on questions answered from your material." : undefined}
            action={
              topics.length > 0 && (
                <Link href={`/w/${ws.id}/gaps`} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-hover">
                  View topic gaps report <ArrowRight className="size-3.5" />
                </Link>
              )
            }
          />
          {topics.length === 0 ? (
            <p className="py-4 text-sm text-muted">Topics will be extracted and assessed once your material is uploaded and processed.</p>
          ) : (
            <>
              <MasteryMix counts={counts} className="mt-1" />
              <div className="mt-5 border-t border-border pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-faint">Topics needing attention</h3>
                {attention.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">
                    {submitted.length ? "No weak or developing topics flagged currently." : "Complete a quiz to identify gaps; topics remain unassessed until tested."}
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-border">
                    {attention.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 py-2.5">
                        <Target className="size-4 shrink-0 text-faint" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{t.name}</span>
                        <span className="hidden text-xs tabular-nums text-muted sm:inline">{pct(t.score)} · {t.n_questions} answers</span>
                        <MasteryBadge state={t.state} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </Card>

        <Card className="flex flex-col p-5">
          <SectionTitle title="Today's Revision" />
          {!plan ? (
            <p className="py-2 text-sm text-muted">
              No plan generated yet. {submitted.length ? "Create one from your quiz results." : "Take your first check-in quiz to generate a tailored plan."}
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-semibold tabular-nums text-ink">{todayDone}</span>
                <span className="text-sm text-muted">of {dueNow.length} tasks completed today</span>
              </div>
              <Progress
                value={dueNow.length ? (todayDone / dueNow.length) * 100 : 0}
                barClassName="bg-[#16845B]"
                className="mt-3"
                label="Today's tasks completed"
              />
              <ul className="mt-4 space-y-2">
                {dueNow.filter((t) => !t.done).slice(0, 3).map((t) => (
                  <li key={t.id} className="flex items-start gap-2 text-xs">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                    <span className="min-w-0">
                      <span className="font-medium text-ink">{t.topic_name}</span>{" "}
                      <span className="text-muted">· {ACTIVITY_LABEL[t.activity].toLowerCase()}, {t.minutes} min</span>
                    </span>
                  </li>
                ))}
                {dueNow.length > 0 && todayDone === dueNow.length && (
                  <li className="flex items-center gap-1.5 text-xs font-medium text-[#16845B]">
                    <CheckCircle2 className="size-3.5" /> All tasks completed for today
                  </li>
                )}
              </ul>
              <p className="mt-3 text-xs text-faint">Overall plan: {allDone}/{tasks.length} total tasks completed</p>
              <Link href={`/w/${ws.id}/plan`} className="mt-auto pt-4 text-xs font-medium text-brand hover:text-brand-hover">
                Open revision plan →
              </Link>
            </>
          )}
        </Card>
      </div>

      {/* 4. Recent materials + Assessment trend */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <SectionTitle
            title="Recent Materials"
            action={
              <Link href={`/w/${ws.id}/documents`} className="text-xs font-medium text-brand hover:text-brand-hover">
                All materials
              </Link>
            }
          />
          {docs.length === 0 ? (
            <p className="py-2 text-sm text-muted">No study materials uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {docs.slice(0, 4).map((d) => (
                <li key={d.id} className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-subtle text-muted">
                    <FileText className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">{d.title.replace(/^SAMPLE — /, "")}</span>
                  <StatusPill status={d.status as DocStatus} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <SectionTitle
            title="Assessment Trends"
            hint="Score progress across consecutive quiz attempts"
            action={
              delta !== null && (
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${delta >= 0 ? "text-[#16845B]" : "text-[#C34848]"}`}>
                  {delta >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />} {delta >= 0 ? "+" : ""}{delta} points from baseline
                </span>
              )
            }
          />
          {trend.length >= 2 ? (
            <ScoreTrend data={trend} />
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-subtle/50 px-4 py-8 text-center text-sm text-muted">
              {trend.length === 1
                ? `Baseline quiz completed (${trend[0].score}%). Take another quiz to see your performance trajectory.`
                : "Performance trends will render automatically after completing at least two quiz attempts."}
            </div>
          )}
          {submitted.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
              <span className="text-muted">
                {submitted.length} quiz{submitted.length === 1 ? "" : "zes"} taken · {minutesLabel(tasks.filter((t) => t.done).reduce((s, t) => s + t.minutes, 0))} revision logged
              </span>
              <Link href={`/w/${ws.id}/quizzes`} className="font-medium text-brand hover:text-brand-hover">
                Quiz history
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
