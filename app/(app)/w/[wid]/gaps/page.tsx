import { BookOpen, CheckCircle2, History, MessageSquareText, Network, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MasteryBadge, MasteryMix, MASTERY_META } from "@/components/badges";
import { CitationChip } from "@/components/citation";
import { BuildTopicsButton, GenerateQuizButton } from "@/components/topic-actions";
import { LinkButton } from "@/components/ui/button";
import { Card, Disclosure, EmptyState, PageHeader, Progress } from "@/components/ui/primitives";
import { MASTERY } from "@/lib/core/config";
import type { MasteryState } from "@/lib/core/types";
import { loadWorkspacePage } from "@/lib/services/pages";
import { getTopics, type TopicView } from "@/lib/services/queries";
import { cn, pct } from "@/lib/utils";

export const metadata: Metadata = { title: "Topic Gaps" };

const ORDER: MasteryState[] = ["weak", "developing", "not_assessed", "strong"];
const SECTIONS: Record<MasteryState, { id: string; title: string; hint: string }> = {
  weak: { id: "needs-practice", title: "Needs practice", hint: "Your recent answers show these topics require targeted review and practice." },
  developing: { id: "developing", title: "Developing", hint: "Mixed assessment results — a few more practice questions will solidify your understanding." },
  not_assessed: { id: "not-assessed", title: "Not assessed yet", hint: "Insufficient question data to classify knowledge. Take a quiz to assess these topics." },
  strong: { id: "strong", title: "Strong", hint: "Consistently demonstrated mastery on questions from your study materials." },
};

interface Evidence { stem: string; is_correct: boolean }

export default async function TopicGapsPage({ params }: PageProps<"/w/[wid]/gaps">) {
  const { supabase, ws } = await loadWorkspacePage(params);
  const [topics, { data: resp }, { count: readyDocs }, { count: quizCount }] = await Promise.all([
    getTopics(supabase, ws.id),
    supabase
      .from("quiz_responses")
      .select("is_correct, created_at, quiz_questions(stem, topic_id), quizzes!inner(workspace_id)")
      .eq("quizzes.workspace_id", ws.id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("status", "ready"),
    supabase.from("quizzes").select("id", { count: "exact", head: true }).eq("workspace_id", ws.id).eq("status", "submitted"),
  ]);

  const evidence = new Map<string, Evidence[]>();
  for (const r of (resp ?? []) as unknown as { is_correct: boolean; quiz_questions: { stem: string; topic_id: string | null } | null }[]) {
    const tid = r.quiz_questions?.topic_id;
    if (!tid) continue;
    evidence.set(tid, [...(evidence.get(tid) ?? []), { stem: r.quiz_questions!.stem, is_correct: r.is_correct }]);
  }
  const counts = { weak: 0, developing: 0, strong: 0, not_assessed: 0 } as Record<MasteryState, number>;
  for (const t of topics) counts[t.state]++;
  const names = new Map(topics.map((t) => [t.id, t.name]));

  if (topics.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Topic Gaps" title="Topic Assessment Report" description="Understand which topics you know well, which need practice, and what your assessments reveal." />
        <EmptyState
          icon={<Network />}
          title={(readyDocs ?? 0) > 0 ? "Find your topics" : "Upload study material first"}
          description={(readyDocs ?? 0) > 0
            ? "Extract topics directly from your uploaded materials to index your syllabus and prepare quizzes."
            : "Topic extraction requires syllabus documents or notes. Upload them in My Materials to get started."}
          action={(readyDocs ?? 0) > 0 ? <BuildTopicsButton workspaceId={ws.id} /> : <LinkButton href={`/w/${ws.id}/documents`}><BookOpen /> Go to My Materials</LinkButton>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Topic Gaps"
        title="Topic Assessment Report"
        description="Understand which topics you know well, which need practice, and what your assessments reveal."
        actions={<GenerateQuizButton workspaceId={ws.id} label={(quizCount ?? 0) ? "Take another quiz" : "Take a quick quiz"} />}
      />

      <Card className="mb-8 p-5 sm:p-6">
        <MasteryMix counts={counts} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <nav aria-label="Jump to section" className="flex flex-wrap gap-2">
            {ORDER.filter((s) => counts[s] > 0).map((s) => (
              <a
                key={s}
                href={`#${SECTIONS[s].id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted hover:border-border-strong hover:text-ink transition-colors"
              >
                <span className={cn("size-2 rounded-full", MASTERY_META[s].dot)} aria-hidden />
                {SECTIONS[s].title} · {counts[s]}
              </a>
            ))}
          </nav>
          <Link href={`/w/${ws.id}/quizzes`} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-hover">
            <History className="size-3.5" aria-hidden /> Quiz attempt history
          </Link>
        </div>
        <Disclosure summary="How does the system determine a topic's status?" className="mt-3">
          <p className="max-w-3xl text-xs leading-relaxed text-muted">
            Each quiz response is mapped back to its primary topic chunk. Question difficulty and response recency weight the overall score.
            A topic requires at least {MASTERY.minQuestions} answered questions to transition out of <em>Not assessed</em>.
            Scores below {pct(MASTERY.weakBelow)} are marked <em>Needs practice</em>; scores below {pct(MASTERY.strongAtOrAbove)} are <em>Developing</em>;
            and higher scores are classified as <em>Strong</em>. With fewer than {MASTERY.provisionalBelow} responses, ratings are marked with an <em>early estimate</em> tag.
          </p>
        </Disclosure>
      </Card>

      <div className="space-y-10">
        {ORDER.map((state) => {
          const group = topics.filter((t) => t.state === state).sort((a, b) => (state === "strong" ? b.score - a.score : a.score - b.score));
          if (!group.length) return null;
          const s = SECTIONS[state];
          return (
            <section key={state} aria-labelledby={`${s.id}-h`} id={s.id} className="scroll-mt-24">
              <div className="mb-1 flex items-center gap-2">
                <span className={cn("size-2.5 rounded-full", MASTERY_META[state].dot)} aria-hidden />
                <h2 id={`${s.id}-h`} className="text-base font-semibold text-ink">
                  {s.title} <span className="font-normal text-faint">({group.length})</span>
                </h2>
              </div>
              <p className="mb-4 text-xs text-muted">{s.hint}</p>
              <div className="grid gap-4 md:grid-cols-2">
                {group.map((t) => (
                  <TopicCard
                    key={t.id}
                    topic={t}
                    evidence={evidence.get(t.id) ?? []}
                    workspaceId={ws.id}
                    parentName={t.parent_id ? names.get(t.parent_id) : undefined}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-10 flex flex-col items-center gap-2 border-t border-border pt-6 text-center text-xs text-muted sm:flex-row sm:justify-center">
        <span>Added new study materials or notes?</span>
        <BuildTopicsButton workspaceId={ws.id} rebuild variant="secondary" size="sm" />
      </div>
    </>
  );
}

function TopicCard({ topic: t, evidence, workspaceId, parentName }: { topic: TopicView; evidence: Evidence[]; workspaceId: string; parentName?: string }) {
  const missed = evidence.filter((e) => !e.is_correct);
  const right = evidence.filter((e) => e.is_correct);
  const assessed = t.state !== "not_assessed";

  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {parentName && <div className="text-[11px] font-medium text-faint">Part of {parentName}</div>}
          <h3 className="font-semibold text-ink leading-snug">{t.name}</h3>
        </div>
        <MasteryBadge state={t.state} provisional={t.provisional} />
      </div>
      {t.summary && <p className="mt-1.5 text-xs leading-relaxed text-muted">{t.summary}</p>}

      <div className="mt-3.5 border-t border-border/70 pt-3">
        {assessed ? (
          <>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted">Estimated mastery</span>
              <span className="font-semibold tabular-nums text-ink">{pct(t.score)}</span>
            </div>
            <Progress value={t.score * 100} barClassName={MASTERY_META[t.state].bar} label={`${t.name}: estimated understanding`} />
            <p className="mt-1.5 text-[11px] text-muted">
              Based on {t.n_questions} question{t.n_questions === 1 ? "" : "s"} ({t.n_correct} correct){t.provisional ? " · early estimate" : ""}
            </p>
          </>
        ) : (
          <div className="rounded-md border border-border bg-subtle/50 px-3 py-2 text-xs text-muted">
            {t.n_questions === 0 ? "No questions answered on this topic yet." : `${t.n_questions} question answered so far. Needs at least ${MASTERY.minQuestions} for evaluation.`}
          </div>
        )}
      </div>

      {(t.reasons.length > 0 || evidence.length > 0) && assessed && (
        <Disclosure summary="Why this status?" className="mt-3">
          <ul className="space-y-1 text-xs text-muted">
            {t.reasons.map((r) => (
              <li key={r} className="flex gap-1.5">
                <span className="text-faint" aria-hidden>•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          {(missed.length > 0 || right.length > 0) && (
            <div className="mt-2.5 space-y-1.5 border-t border-border pt-2.5 text-xs">
              {missed.slice(0, 3).map((m, i) => (
                <p key={"m" + i} className="flex gap-2 text-ink">
                  <XCircle className="mt-0.5 size-3.5 shrink-0 text-[#C34848]" aria-label="Missed question" />
                  <span className="leading-snug">{m.stem}</span>
                </p>
              ))}
              {right.slice(0, 2).map((m, i) => (
                <p key={"r" + i} className="flex gap-2 text-muted">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#16845B]" aria-label="Correct question" />
                  <span className="leading-snug">{m.stem}</span>
                </p>
              ))}
            </div>
          )}
        </Disclosure>
      )}

      {t.sources.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-medium text-faint">Referenced material sources</div>
          <div className="flex flex-wrap gap-1.5">
            {t.sources.slice(0, 2).map((s) => (
              <CitationChip key={s.chunk_id} citation={s} />
            ))}
            {t.sources.length > 2 && <span className="self-center text-xs text-faint">+{t.sources.length - 2} more</span>}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-4 border-t border-border/60">
        <GenerateQuizButton
          workspaceId={workspaceId}
          topicIds={[t.id]}
          label={assessed ? "Practise topic" : "Check topic"}
          variant="soft"
          size="sm"
        />
        {(t.state === "weak" || t.state === "developing") && (
          <LinkButton href={`/w/${workspaceId}/tutor?topic=${t.id}`} variant="ghost" size="sm">
            <MessageSquareText className="size-3.5" /> Ask AI Tutor
          </LinkButton>
        )}
      </div>
    </Card>
  );
}
