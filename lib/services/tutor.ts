import "server-only";
import { generateJson } from "@/lib/ai/gemini";
import { passageBlock, TUTOR_SYSTEM } from "@/lib/ai/prompts";
import { tutorJsonSchema, tutorOut } from "@/lib/ai/schemas";
import { extractInlineLabels, labelSources, renumberLabels, resolveLabels, stripAllLabels, toCitation } from "@/lib/core/citations";
import { RETRIEVAL } from "@/lib/core/config";
import type { Citation } from "@/lib/core/types";
import type { Supabase } from "@/lib/supabase/server";
import { check, checkMaybe } from "./http";
import { retrieve } from "./retrieval";

const HISTORY_TURNS = 6;
const INSUFFICIENT =
  "I couldn't find enough in your uploaded material to answer that reliably. Try rephrasing, choosing a topic, or uploading notes that cover it.";

export interface TutorAnswer {
  answer_markdown: string;
  citations: Citation[];
  insufficient_evidence: boolean;
  practice_question: string | null;
}

/**
 * Retrieval happens for every question; chat history is bounded and only provides
 * conversational context. Answers without a valid citation are not shown as grounded.
 */
export async function askTutor(supabase: Supabase, workspaceId: string, message: string, topicId?: string | null): Promise<TutorAnswer> {
  let topicName = "";
  if (topicId) {
    const t = await supabase.from("topics").select("name").eq("id", topicId).eq("workspace_id", workspaceId).maybeSingle();
    topicName = t.data?.name ?? "";
  }
  const query = topicName ? `${topicName}: ${message}` : message;
  const chunks = await retrieve(supabase, workspaceId, query);

  let answer: TutorAnswer;
  if (!chunks.length || Math.max(...chunks.map((c) => c.similarity)) < RETRIEVAL.minSimilarity) {
    answer = { answer_markdown: INSUFFICIENT, citations: [], insufficient_evidence: true, practice_question: null };
  } else {
    const history = check(
      await supabase
        .from("tutor_messages")
        .select("role, content")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_TURNS),
      "Load history",
    ).reverse();

    const sources = labelSources(chunks);
    const prompt =
      `Study passages:\n${[...sources].map(([l, c]) => passageBlock(l, c)).join("\n\n")}\n\n` +
      (history.length
        ? `Recent conversation (context only, not a source):\n${history.map((h) => `${h.role}: ${h.content.slice(0, 600)}`).join("\n")}\n\n`
        : "") +
      (topicName ? `Selected topic: ${topicName}\n` : "") +
      `Student question: ${message}`;

    const out = await generateJson({ system: TUTOR_SYSTEM, prompt, jsonSchema: tutorJsonSchema, schema: tutorOut, temperature: 0.3 });
    const cited = resolveLabels([...out.source_labels, ...extractInlineLabels(out.answer_markdown)], sources);
    if (out.insufficient_evidence || !cited.length) {
      answer = {
        answer_markdown: out.insufficient_evidence ? stripAllLabels(out.answer_markdown) || INSUFFICIENT : INSUFFICIENT,
        citations: [],
        insufficient_evidence: true,
        practice_question: null,
      };
    } else {
      answer = {
        // Inline labels are renumbered to match the citation list shown to the student.
        answer_markdown: renumberLabels(out.answer_markdown, sources, cited),
        citations: cited.map((c) => toCitation(c)),
        insufficient_evidence: false,
        practice_question: out.practice_question ?? null,
      };
    }
  }

  // Two inserts (not one batch) so the question gets an earlier timestamp than its answer,
  // keeping the conversation in order when it's reloaded.
  checkMaybe(
    await supabase.from("tutor_messages").insert({ workspace_id: workspaceId, topic_id: topicId ?? null, role: "user", content: message, citations: [], insufficient_evidence: false }),
    "Save question",
  );
  checkMaybe(
    await supabase.from("tutor_messages").insert({
      workspace_id: workspaceId,
      topic_id: topicId ?? null,
      role: "assistant",
      content: answer.answer_markdown + (answer.practice_question ? `\n\n**Try this:** ${answer.practice_question}` : ""),
      citations: answer.citations,
      insufficient_evidence: answer.insufficient_evidence,
    }),
    "Save answer",
  );
  return answer;
}
