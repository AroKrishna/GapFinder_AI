import "server-only";
import { embedTexts, generateJson } from "@/lib/ai/gemini";
import { passageBlock, QUIZ_SYSTEM } from "@/lib/ai/prompts";
import { quizJsonSchema, quizOut } from "@/lib/ai/schemas";
import { QUIZ } from "@/lib/core/config";
import { computeTopicMastery, type GradedResponse } from "@/lib/core/mastery";
import { validateQuestions } from "@/lib/core/quizValidate";
import { scoreQuiz } from "@/lib/core/scoring";
import type { RetrievedChunk } from "@/lib/core/types";
import type { Supabase } from "@/lib/supabase/server";
import { logActivity } from "./auth";
import { check, checkMaybe, HttpError, notFound } from "./http";
import { retrieveWithEmbedding } from "./retrieval";

interface TopicRow {
  id: string;
  name: string;
  summary: string;
  importance: number;
  topic_mastery: { state: string; score: number } | null;
}

const STATE_ORDER: Record<string, number> = { not_assessed: 0, weak: 1, developing: 2, strong: 3 };

/** Choose topics to assess: explicit selection, else unassessed/weak first, then by importance. */
function pickTopics(topics: TopicRow[], requested?: string[]): TopicRow[] {
  if (requested?.length) return topics.filter((t) => requested.includes(t.id)).slice(0, QUIZ.maxTopics);
  return [...topics]
    .sort(
      (a, b) =>
        (STATE_ORDER[a.topic_mastery?.state ?? "not_assessed"] - STATE_ORDER[b.topic_mastery?.state ?? "not_assessed"]) ||
        b.importance - a.importance,
    )
    .slice(0, QUIZ.maxTopics);
}

export async function generateQuiz(supabase: Supabase, workspaceId: string, topicIds?: string[]) {
  const topics = check(
    await supabase
      .from("topics")
      .select("id, name, summary, importance, topic_mastery(state, score)")
      .eq("workspace_id", workspaceId),
    "Load topics",
  ) as unknown as TopicRow[];
  if (!topics.length) throw new HttpError(422, "Build the topic map first — quizzes are generated per topic.");
  const chosen = pickTopics(topics, topicIds);
  if (!chosen.length) throw new HttpError(422, "None of the selected topics were found.");

  // 1) Retrieval (one batched embedding call, one hybrid search per topic).
  const queries = chosen.map((t) => `${t.name}. ${t.summary}`);
  const vectors = await embedTexts(queries, "RETRIEVAL_QUERY");
  const topicLabels = new Map<string, string>();
  const sourcesByTopic = new Map<string, Map<string, RetrievedChunk>>();
  const blocks: string[] = [];
  let s = 0;
  for (let i = 0; i < chosen.length; i++) {
    const t = chosen[i];
    const chunks = await retrieveWithEmbedding(supabase, workspaceId, vectors[i], queries[i], QUIZ.chunksPerTopic);
    if (!chunks.length) continue;
    const label = `T${i + 1}`;
    topicLabels.set(label, t.id);
    const map = new Map<string, RetrievedChunk>();
    const passages = chunks.map((c) => {
      const sl = `S${++s}`;
      map.set(sl, c);
      return passageBlock(sl, c);
    });
    sourcesByTopic.set(t.id, map);
    blocks.push(`## Topic ${label}: ${t.name}\n${passages.join("\n")}`);
  }
  if (!blocks.length) throw new HttpError(422, "Not enough indexed material to write grounded questions.");

  // 2) Grounded generation.
  const prompt =
    `${blocks.join("\n\n")}\n\nWrite ${QUIZ.questionsPerTopic} questions for each topic above ` +
    `(use the topic label, e.g. "T1", in the "topic" field, and cite only that topic's passage labels).`;
  const out = await generateJson({ system: QUIZ_SYSTEM, prompt, jsonSchema: quizJsonSchema, schema: quizOut, temperature: 0.4 });

  // 3) Deterministic validation against retrieved passages.
  const { valid, rejected } = validateQuestions(out.questions, topicLabels, sourcesByTopic);
  if (rejected.length) console.info("[quiz] rejected", rejected);
  if (!valid.length) throw new HttpError(422, "The AI could not produce questions grounded in your material. Please retry.");

  const quiz = check(
    await supabase
      .from("quizzes")
      .insert({ workspace_id: workspaceId, question_count: valid.length, rejected_count: rejected.length })
      .select("id")
      .single(),
    "Create quiz",
  );
  const ins = await supabase.from("quiz_questions").insert(valid.map((q, i) => ({ ...q, quiz_id: quiz.id, position: i })));
  if (ins.error) {
    await supabase.from("quizzes").delete().eq("id", quiz.id);
    checkMaybe(ins, "Save questions");
  }
  await logActivity(supabase, workspaceId, "quiz_created", `Generated a ${valid.length}-question quiz`);
  return { quiz_id: quiz.id, question_count: valid.length, rejected_count: rejected.length };
}

/**
 * Idempotent submission. Responses are unique per question (DB constraint) and their
 * correctness is set by a DB trigger from the stored answer key. A second submit returns
 * the stored result unchanged.
 */
export async function submitQuiz(supabase: Supabase, quizId: string, answers: { question_id: string; selected_index: number }[]) {
  const quiz = checkMaybe(
    await supabase.from("quizzes").select("id, workspace_id, status").eq("id", quizId).maybeSingle(),
    "Load quiz",
  );
  if (!quiz) throw notFound("Quiz");

  const questions = check(
    await supabase.from("quiz_questions").select("id, correct_index").eq("quiz_id", quizId).order("position"),
    "Load questions",
  );

  if (quiz.status === "ready") {
    const ids = new Set(questions.map((q) => q.id));
    const rows = answers
      .filter((a) => ids.has(a.question_id))
      .map((a) => ({ quiz_id: quizId, question_id: a.question_id, selected_index: a.selected_index }));
    if (new Set(rows.map((r) => r.question_id)).size !== questions.length) {
      throw new HttpError(400, "Please answer every question before submitting.");
    }
    if (rows.length) {
      checkMaybe(
        await supabase.from("quiz_responses").upsert(rows, { onConflict: "question_id", ignoreDuplicates: true }),
        "Save responses",
      );
    }
  }

  // Score from what is persisted, so retries/concurrent submits converge on one result.
  const stored = check(
    await supabase.from("quiz_responses").select("question_id, selected_index, is_correct").eq("quiz_id", quizId),
    "Load responses",
  );
  const result = scoreQuiz(questions, new Map(stored.map((r) => [r.question_id, r.selected_index])));

  if (quiz.status === "ready") {
    const { data: flipped } = await supabase
      .from("quizzes")
      .update({ status: "submitted", submitted_at: new Date().toISOString(), score: result.score, correct_count: result.correct })
      .eq("id", quizId)
      .eq("status", "ready")
      .select("id");
    if (flipped?.length) {
      await recomputeMastery(supabase, quiz.workspace_id, quizId);
      await logActivity(supabase, quiz.workspace_id, "quiz_submitted", `Scored ${result.correct}/${result.total} on a quiz`);
    }
  }
  return { quiz_id: quizId, workspace_id: quiz.workspace_id, ...result };
}

interface ResponseRow {
  question_id: string;
  quiz_id: string;
  is_correct: boolean;
  created_at: string;
  quiz_questions: { topic_id: string | null; difficulty: number } | null;
  quizzes: { workspace_id: string } | null;
}

/** Recompute mastery for every topic in the workspace from all persisted responses. */
export async function recomputeMastery(supabase: Supabase, workspaceId: string, quizId: string | null) {
  const [topicsRes, respRes] = await Promise.all([
    supabase.from("topics").select("id").eq("workspace_id", workspaceId),
    supabase
      .from("quiz_responses")
      .select("question_id, quiz_id, is_correct, created_at, quiz_questions(topic_id, difficulty), quizzes!inner(workspace_id)")
      .eq("quizzes.workspace_id", workspaceId),
  ]);
  const topics = check(topicsRes, "Load topics");
  const responses: GradedResponse[] = (check(respRes, "Load responses") as unknown as ResponseRow[])
    .filter((r) => r.quiz_questions?.topic_id)
    .map((r) => ({
      topic_id: r.quiz_questions!.topic_id!,
      question_id: r.question_id,
      quiz_id: r.quiz_id,
      is_correct: r.is_correct,
      difficulty: r.quiz_questions!.difficulty,
      answered_at: new Date(r.created_at),
    }));

  const now = new Date();
  const masteries = topics.map((t) => computeTopicMastery(t.id, responses, now));
  if (!masteries.length) return;
  checkMaybe(
    await supabase.from("topic_mastery").upsert(
      masteries.map((m) => ({
        topic_id: m.topic_id,
        workspace_id: workspaceId,
        score: m.score,
        n_questions: m.n_questions,
        n_correct: m.n_correct,
        state: m.state,
        provisional: m.provisional,
        reasons: m.reasons,
        updated_at: now.toISOString(),
      })),
      { onConflict: "topic_id" },
    ),
    "Save mastery",
  );

  if (quizId) {
    const touched = new Set(responses.filter((r) => r.quiz_id === quizId).map((r) => r.topic_id));
    const history = masteries
      .filter((m) => touched.has(m.topic_id))
      .map((m) => ({ workspace_id: workspaceId, topic_id: m.topic_id, quiz_id: quizId, score: m.score, state: m.state, n_questions: m.n_questions }));
    if (history.length) checkMaybe(await supabase.from("mastery_history").insert(history), "Save mastery history");
  }
}
