import { CalendarCheck, CalendarDays, CheckCircle2, Clock, History, MessageSquareText } from "lucide-react";
import type { Metadata } from "next";
import { CitationChip } from "@/components/citation";
import { GeneratePlanButton, GenerateQuizButton } from "@/components/topic-actions";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, Disclosure, EmptyState, PageHeader, Progress, SectionTitle } from "@/components/ui/primitives";
import { ACTIVITY_LABEL } from "@/lib/core/planner";
import type { Citation, TaskActivity } from "@/lib/core/types";
import { loadWorkspacePage } from "@/lib/services/pages";
import { todayISO } from "@/lib/services/plan";
import { getCitations } from "@/lib/services/queries";
import { cn, examCountdown, formatDate, minutesLabel } from "@/lib/utils";
import { TaskToggle } from "./task-toggle";

export const metadata: Metadata = { title: "Today's Revision" };

interface Task {
  id: string;
  topic_id: string | null;
  topic_name: string;
  activity: TaskActivity;
  priority: number;
  minutes: number;
  reason: string;
  source_chunk_ids: string[];
  due_date: string;
  done: boolean;
}

const ACTIVITY_STYLE: Record<TaskActivity, string> = {
  read: "border-border bg-subtle text-muted",
  tutor: "border-brand-border bg-brand-soft text-brand",
  practice: "border-[#FCE8BD] bg-[#FFF5DE] text-[#A66A0A]",
  assess: "border-brand-border bg-brand-soft text-brand-strong",
  review: "border-[#C8EED9] bg-[#EAF7F0] text-[#16845B]",
};

export default async function RevisionPage({ params }: PageProps<"/w/[wid]/plan">) {
  const { supabase, ws } = await loadWorkspacePage(params);
  const [{ data: plans }, { count: topicCount }] = await Promise.all([
    supabase
      .from("revision_plans")
      .select("id, version, budget_minutes, change_summary, unscheduled, created_at")
      .eq("workspace_id", ws.id)
      .order("version", { ascending: false })
      .limit(10),
    supabase.from("topics").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
  ]);
  const plan = plans?.[0];

  if (!plan) {
    return (
      <>
        <PageHeader
          eyebrow="Today's Revision"
          title="Today's Revision"
          description="A clear plan for what to study next, based on your learning gaps and exam date."
        />
        <EmptyState
          icon={<CalendarCheck />}
          title="No revision plan generated yet"
          description={(topicCount ?? 0) > 0
            ? "We schedule practice for weak topics first, and short review check-ins for unassessed topics — tailored to your daily study hours."
            : "Your revision plan is constructed from your assessed topics. Upload materials and find topics to begin."}
          action={(topicCount ?? 0) > 0 ? <GeneratePlanButton workspaceId={ws.id} /> : <LinkButton href={`/w/${ws.id}/documents`}>Go to My Materials</LinkButton>}
        />
      </>
    );
  }

  const { data: taskRows } = await supabase
    .from("revision_tasks")
    .select("id, topic_id, topic_name, activity, priority, minutes, reason, source_chunk_ids, due_date, done")
    .eq("plan_id", plan.id)
    .order("due_date")
    .order("priority", { ascending: false });
  const tasks = (taskRows ?? []) as Task[];
  const sourceMap = await getCitations(supabase, tasks.flatMap((t) => t.source_chunk_ids.slice(0, 1)));
  const citations = { get: (id: string | undefined) => (id ? sourceMap.get(id) : undefined) };
  const today = todayISO();

  const catchUp = tasks.filter((t) => t.due_date < today && !t.done);
  const todays = tasks.filter((t) => t.due_date === today);
  const later = tasks.filter((t) => t.due_date > today);
  const byDay = new Map<string, Task[]>();
  for (const t of later) byDay.set(t.due_date, [...(byDay.get(t.due_date) ?? []), t]);

  const todayDone = todays.filter((t) => t.done).length;
  const todayLeft = todays.filter((t) => !t.done).reduce((s, t) => s + t.minutes, 0);
  const allDone = tasks.filter((t) => t.done).length;
  const summary = (plan.change_summary ?? []) as string[];
  const unscheduled = (plan.unscheduled ?? []) as { topic_name: string; activity: TaskActivity; minutes: number }[];

  return (
    <>
      <PageHeader
        eyebrow="Today's Revision"
        title="Today's Revision"
        description="A clear plan for what to study next, based on your learning gaps and exam date."
        actions={<GeneratePlanButton workspaceId={ws.id} label="Update plan from latest results" variant="secondary" stay />}
      />

      {/* Progress Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs font-medium text-muted">Today&apos;s Progress</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
            {todayDone}/{todays.length} <span className="text-xs font-normal text-muted">tasks completed</span>
          </div>
          <Progress
            value={todays.length ? (todayDone / todays.length) * 100 : 0}
            barClassName="bg-[#16845B]"
            className="mt-3"
            label="Today's tasks completed"
          />
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium text-muted">Remaining Time Today</div>
          <div className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold tabular-nums text-ink">
            <Clock className="size-4 text-faint" aria-hidden /> {minutesLabel(todayLeft)}
          </div>
          <div className="mt-2 text-xs text-muted">Target budget: {ws.hours_per_day} hours/day</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium text-muted">Full Plan Completion</div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
            {allDone}/{tasks.length} <span className="text-xs font-normal text-muted">tasks done</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <CalendarDays className="size-3.5 text-faint" aria-hidden /> {examCountdown(ws.exam_date)}
          </div>
        </Card>
      </div>

      <div className="space-y-8">
        {/* 1. Catch-up tasks */}
        {catchUp.length > 0 && (
          <section aria-labelledby="catchup-h">
            <SectionTitle id="catchup-h" title="Overdue Catch-up Tasks" count={catchUp.length} hint="Tasks scheduled previously that remain incomplete." />
            <div className="space-y-3">
              {catchUp.map((t) => (
                <TaskCard key={t.id} task={t} wid={ws.id} cite={citations.get(t.source_chunk_ids[0])} showDate />
              ))}
            </div>
          </section>
        )}

        {/* 2. Today's tasks */}
        <section aria-labelledby="today-h">
          <SectionTitle
            id="today-h"
            title={`Today · ${formatDate(today, { weekday: "long", day: "numeric", month: "short" })}`}
            count={todays.length}
          />
          {todays.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface px-5 py-6 text-center text-xs text-muted">
              No tasks scheduled for today. {later.length ? "Upcoming tasks are listed below." : "Generate or refresh your plan after taking a quiz."}
            </div>
          ) : (
            <div className="space-y-3">
              {todays.map((t) => (
                <TaskCard key={t.id} task={t} wid={ws.id} cite={citations.get(t.source_chunk_ids[0])} />
              ))}
            </div>
          )}
        </section>

        {/* 3. Upcoming tasks */}
        {byDay.size > 0 && (
          <section aria-labelledby="later-h">
            <SectionTitle id="later-h" title="Upcoming Schedule" />
            <div className="space-y-4">
              {[...byDay.entries()].map(([day, list]) => (
                <div key={day}>
                  <h3 className="mb-2 text-xs font-semibold text-muted">
                    {formatDate(day, { weekday: "long", day: "numeric", month: "short" })} · {minutesLabel(list.reduce((s, t) => s + t.minutes, 0))}
                  </h3>
                  <Card className="divide-y divide-border">
                    {list.map((t) => (
                      <div key={t.id} className={cn("flex items-start gap-3 px-4 py-3", t.done && "opacity-60")}>
                        <TaskToggle taskId={t.id} done={t.done} label={`${ACTIVITY_LABEL[t.activity]}: ${t.topic_name}`} />
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("text-xs font-semibold", t.done && "line-through text-muted")}>{t.topic_name}</span>
                            <Badge className={ACTIVITY_STYLE[t.activity]}>{ACTIVITY_LABEL[t.activity]}</Badge>
                            <span className="text-[11px] text-muted">{t.minutes} min</span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted">{t.reason}</p>
                        </div>
                      </div>
                    ))}
                  </Card>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Plan explanation */}
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink">
            <History className="size-3.5 text-brand" aria-hidden /> Plan Logic &amp; Prioritization
          </div>
          <p className="mt-1 text-xs text-muted">
            This plan prioritizes topics where your recent assessment answers indicate knowledge gaps, distributed to respect your exam deadline and daily study budget.
          </p>
          {summary.length > 0 && (
            <ul className="mt-2.5 space-y-1 text-xs text-muted border-t border-border pt-2.5">
              {summary.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="text-faint">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
          {unscheduled.length > 0 && (
            <div className="mt-3 rounded-md border border-[#FCE8BD] bg-[#FFF5DE] px-3 py-2 text-xs text-[#A66A0A]">
              Could not fit within study budget: {unscheduled.map((u) => `${u.topic_name} (${ACTIVITY_LABEL[u.activity].toLowerCase()}, ${u.minutes} min)`).join("; ")}.
              Increase daily hours in Subject settings to accommodate them.
            </div>
          )}
          <p className="mt-3 text-[11px] text-faint">
            Plan version {plan.version} · generated {formatDate(plan.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · total budget {minutesLabel(plan.budget_minutes)}
          </p>
          {plans && plans.length > 1 && (
            <Disclosure summary="View previous plan versions" className="mt-2">
              <ul className="space-y-1 text-xs text-muted">
                {plans.slice(1).map((p) => (
                  <li key={p.id}>
                    <span className="font-semibold text-ink">Version {p.version}</span> ({formatDate(p.created_at)}): {((p.change_summary ?? []) as string[])[0]}
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </Card>
      </div>
    </>
  );
}

function TaskCard({ task: t, wid, cite, showDate }: { task: Task; wid: string; cite?: Citation; showDate?: boolean }) {
  return (
    <Card className={cn("p-4", t.done && "bg-subtle/40")}>
      <div className="flex items-start gap-3">
        <TaskToggle taskId={t.id} done={t.done} label={`${ACTIVITY_LABEL[t.activity]}: ${t.topic_name}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("text-sm font-semibold", t.done && "text-muted line-through")}>{t.topic_name}</h3>
            <Badge className={ACTIVITY_STYLE[t.activity]}>{ACTIVITY_LABEL[t.activity]}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Clock className="size-3 text-faint" aria-hidden /> {t.minutes} min
            </span>
            {showDate && <span className="text-[11px] text-faint">Originally scheduled {formatDate(t.due_date)}</span>}
            {t.done && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#16845B]">
                <CheckCircle2 className="size-3" /> Completed
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            <span className="font-medium text-ink">Why: </span>{t.reason}
          </p>
          {!t.done && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(t.activity === "practice" || t.activity === "assess") && t.topic_id && (
                <GenerateQuizButton
                  workspaceId={wid}
                  topicIds={[t.topic_id]}
                  label={t.activity === "assess" ? "Start topic check-in" : "Practise topic"}
                  variant="soft"
                  size="sm"
                />
              )}
              {t.activity === "tutor" && t.topic_id && (
                <LinkButton href={`/w/${wid}/tutor?topic=${t.topic_id}`} variant="soft" size="sm">
                  <MessageSquareText className="size-3" /> Ask AI Tutor
                </LinkButton>
              )}
              {(t.activity === "read" || t.activity === "review") && cite && <CitationChip citation={cite} />}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
