import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { CitationChip } from "@/components/citation";
import { GeneratePlanButton } from "@/components/topic-actions";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, SectionTitle } from "@/components/ui/primitives";
import { loadWorkspacePage } from "@/lib/services/pages";
import { getCitations } from "@/lib/services/queries";
import { cn, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Quiz results" };

const LETTERS = ["A", "B", "C", "D"];

interface QRow {
  id: string;
  position: number;
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: number;
  source_chunk_ids: string[];
  evidence_quote: string;
  topic_id: string | null;
  topics: { name: string } | null;
  quiz_responses: { selected_index: number; is_correct: boolean }[] | { selected_index: number; is_correct: boolean } | null;
}

const responseOf = (q: QRow) => (Array.isArray(q.quiz_responses) ? q.quiz_responses[0] : q.quiz_responses);

export default async function ResultsPage({ params }: PageProps<"/w/[wid]/quiz/[qid]/results">) {
  const { qid } = await params;
  const { supabase, ws } = await loadWorkspacePage(params);
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, status, score, correct_count, question_count, submitted_at")
    .eq("id", qid)
    .eq("workspace_id", ws.id)
    .maybeSingle();
  if (!quiz) notFound();
  if (quiz.status !== "submitted") redirect(`/w/${ws.id}/quiz/${qid}`);

  const [{ data }, { count: planCount }] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select("id, position, stem, options, correct_index, explanation, difficulty, source_chunk_ids, evidence_quote, topic_id, topics(name), quiz_responses(selected_index, is_correct)")
      .eq("quiz_id", qid)
      .order("position"),
    supabase.from("revision_plans").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id),
  ]);
  const questions = (data ?? []) as unknown as QRow[];
  const citations = await getCitations(supabase, questions.flatMap((q) => q.source_chunk_ids));

  const byTopic = new Map<string, { name: string; c: number; n: number }>();
  for (const q of questions) {
    const key = q.topic_id ?? "none";
    const e = byTopic.get(key) ?? { name: q.topics?.name ?? "General", c: 0, n: 0 };
    e.n++;
    if (responseOf(q)?.is_correct) e.c++;
    byTopic.set(key, e);
  }
  const missed = questions.filter((q) => !responseOf(q)?.is_correct).length;

  return (
    <>
      <BackLink href={`/w/${ws.id}/quizzes`}>Quiz attempt history</BackLink>

      <div className="mb-8 rounded-[var(--radius-card)] border border-brand-border bg-surface p-6 sm:p-7 shadow-[var(--shadow-card)]">
        <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-brand">Quiz Score</div>
            <div className="mt-1 font-display text-4xl sm:text-5xl font-semibold tabular-nums text-ink">{pct(quiz.score)}</div>
            <div className="mt-1 text-xs text-muted">{quiz.correct_count} of {quiz.question_count} questions correct</div>
          </div>
          <div className="md:border-l md:border-border md:pl-6">
            <div className="text-xs font-semibold uppercase tracking-[0.06em] text-faint">Topic Breakdown</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[...byTopic.values()].map((t) => (
                <Badge
                  key={t.name}
                  className={cn(
                    t.c === t.n
                      ? "border-[#C8EED9] bg-[#EAF7F0] text-[#16845B]"
                      : t.c === 0
                      ? "border-[#FCDADA] bg-[#FFF0F0] text-[#C34848]"
                      : "border-[#FCE8BD] bg-[#FFF5DE] text-[#A66A0A]",
                  )}
                >
                  {t.name}: {t.c}/{t.n} correct
                </Badge>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Your overall topic knowledge states and revision plan have been automatically recalibrated with these results.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton href={`/w/${ws.id}/gaps`} size="sm">
                Explore Topic Gaps <ArrowRight className="size-3.5" />
              </LinkButton>
              <GeneratePlanButton
                workspaceId={ws.id}
                label={(planCount ?? 0) ? "Update revision plan" : "Generate revision plan"}
                variant="secondary"
                size="sm"
              />
            </div>
          </div>
        </div>
      </div>

      <SectionTitle
        title="Review Assessment Answers"
        hint={
          missed
            ? `${missed} question${missed === 1 ? "" : "s"} missed · detailed explanations and grounding sources provided below.`
            : "All questions answered correctly. Review explanations to reinforce understanding."
        }
      />
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const r = responseOf(q);
          const correct = !!r?.is_correct;
          return (
            <Card key={q.id} className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                {correct ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#16845B]" aria-label="Correct" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-[#C34848]" aria-label="Incorrect" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-xs text-muted">
                    Question {idx + 1} · {q.topics?.name ?? "General"}
                  </div>
                  <h3 className="font-semibold text-ink leading-snug">{q.stem}</h3>
                  <ul className="mt-3 space-y-1.5">
                    {q.options.map((o, i) => {
                      const isCorrect = i === q.correct_index;
                      const isSelected = r?.selected_index === i;
                      return (
                        <li
                          key={i}
                          className={cn(
                            "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
                            isCorrect
                              ? "border-[#C8EED9] bg-[#EAF7F0] text-[#16845B]"
                              : isSelected
                              ? "border-[#FCDADA] bg-[#FFF0F0] text-[#C34848]"
                              : "border-border/60 bg-surface text-ink",
                          )}
                        >
                          <span className="font-semibold text-muted">{LETTERS[i]}.</span>
                          <span className="flex-1">{o}</span>
                          {isCorrect && (
                            <span className="shrink-0 font-medium text-[#16845B]">
                              {isSelected ? "Your answer · correct" : "Correct answer"}
                            </span>
                          )}
                          {isSelected && !isCorrect && (
                            <span className="shrink-0 font-medium text-[#C34848]">Your answer</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-3.5 rounded-lg border border-border bg-subtle/60 p-3.5 text-xs leading-relaxed text-ink">
                    <span className="font-semibold text-ink">Explanation: </span>
                    {q.explanation.replace(/\s*\[S\d+\]/g, "")}
                    {q.evidence_quote && (
                      <blockquote className="mt-2 border-l-2 border-brand-border pl-3 text-xs italic text-muted">
                        “{q.evidence_quote}”
                      </blockquote>
                    )}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {q.source_chunk_ids
                      .map((id) => citations.get(id))
                      .filter((c) => !!c)
                      .map((c) => (
                        <CitationChip key={c!.chunk_id} citation={c!} />
                      ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
