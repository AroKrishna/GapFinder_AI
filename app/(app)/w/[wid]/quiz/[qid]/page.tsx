import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { loadWorkspacePage } from "@/lib/services/pages";
import { QuizRunner, type RunnerQuestion } from "./quiz-runner";

export const metadata: Metadata = { title: "Quiz" };

export default async function QuizPage({ params }: PageProps<"/w/[wid]/quiz/[qid]">) {
  const { qid } = await params;
  const { supabase, ws } = await loadWorkspacePage(params);
  const { data: quiz } = await supabase.from("quizzes").select("id, status").eq("id", qid).eq("workspace_id", ws.id).maybeSingle();
  if (!quiz) notFound();
  if (quiz.status === "submitted") redirect(`/w/${ws.id}/quiz/${qid}/results`);

  // Answer keys and explanations are deliberately NOT selected here.
  const { data } = await supabase
    .from("quiz_questions")
    .select("id, position, stem, options, difficulty, topics(name)")
    .eq("quiz_id", qid)
    .order("position");
  const questions: RunnerQuestion[] = ((data ?? []) as unknown as { id: string; stem: string; options: string[]; difficulty: number; topics: { name: string } | null }[]).map(
    (q) => ({ id: q.id, stem: q.stem, options: q.options, difficulty: q.difficulty, topic: q.topics?.name ?? "General" }),
  );

  return (
    <>
      <div className="mx-auto max-w-3xl">
        <BackLink href={`/w/${ws.id}/gaps`}>Leave quiz (answers are saved only when you submit)</BackLink>
      </div>
      <QuizRunner workspaceId={ws.id} quizId={qid} questions={questions} />
    </>
  );
}
