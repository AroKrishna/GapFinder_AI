import { ChevronRight, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { GenerateQuizButton } from "@/components/topic-actions";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { loadWorkspacePage } from "@/lib/services/pages";
import { formatDate, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Quiz history" };

export default async function QuizHistoryPage({ params }: PageProps<"/w/[wid]/quizzes">) {
  const { supabase, ws } = await loadWorkspacePage(params);
  const [{ data: quizzes }, { count: topicCount }] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, status, question_count, correct_count, score, created_at, submitted_at")
      .eq("workspace_id", ws.id)
      .order("created_at", { ascending: false }),
    supabase.from("topics").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
  ]);
  const list = quizzes ?? [];

  return (
    <>
      <BackLink href={`/w/${ws.id}/gaps`}>Topic Gaps</BackLink>
      <PageHeader
        eyebrow="Quizzes"
        title="Quiz Attempt History"
        description="Every quiz is grounded directly in your study materials. Your answers determine knowledge gap classifications and shape your revision schedule."
        actions={(topicCount ?? 0) > 0 && list.length > 0 && <GenerateQuizButton workspaceId={ws.id} label="Take new quiz" />}
      />
      {(topicCount ?? 0) === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="Extract topics first"
          description="Quizzes are generated topic by topic from your uploaded materials."
          action={<LinkButton href={`/w/${ws.id}/gaps`}>Go to Topic Gaps</LinkButton>}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="No quizzes taken yet"
          description="A quick 5-question check-in quiz helps identify which topics you know and where practice is needed."
          action={<GenerateQuizButton workspaceId={ws.id} label="Take a check-in quiz" />}
        />
      ) : (
        <div className="space-y-2.5">
          {list.map((q) => {
            const done = q.status === "submitted";
            return (
              <Link key={q.id} href={done ? `/w/${ws.id}/quiz/${q.id}/results` : `/w/${ws.id}/quiz/${q.id}`} className="block rounded-[var(--radius-card)]">
                <Card interactive className="flex items-center gap-4 p-4">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-lg font-display text-xs font-semibold tabular-nums ${
                      done ? "border border-border bg-subtle text-ink" : "border border-brand-border bg-brand-soft text-brand"
                    }`}
                  >
                    {done ? pct(q.score) : `${q.question_count} Q`}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{q.question_count}-question assessment</span>
                      {done ? (
                        <Badge className="border-[#C8EED9] bg-[#EAF7F0] text-[#16845B]">Completed</Badge>
                      ) : (
                        <Badge className="border-brand-border bg-brand-soft text-brand-strong">In progress</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {done
                        ? `${q.correct_count} of ${q.question_count} correct · submitted ${formatDate(q.submitted_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                        : `Started ${formatDate(q.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · select to resume`}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-faint" aria-hidden />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
