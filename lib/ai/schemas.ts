import { z } from "zod";

// Zod schemas validate model output; the hand-written JSON schemas constrain generation.

export const topicsOut = z.object({
  topics: z
    .array(
      z.object({
        name: z.string().min(2).max(160),
        summary: z.string().max(400).default(""),
        importance: z.number().int().min(1).max(3).catch(2),
        parent: z.string().max(160).nullish(),
        source_labels: z.array(z.string()).default([]),
      }),
    )
    .max(20),
});
export const topicsJsonSchema = {
  type: "object",
  properties: {
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short topic name as used in the material" },
          summary: { type: "string", description: "One sentence on what the topic covers" },
          importance: { type: "integer", minimum: 1, maximum: 3, description: "3 = emphasised by syllabus/material" },
          parent: { type: "string", description: "Name of the parent topic, or empty if top level" },
          source_labels: { type: "array", items: { type: "string" }, description: "Passage labels like C3 that cover it" },
        },
        required: ["name", "summary", "importance", "source_labels"],
      },
    },
  },
  required: ["topics"],
};

export const quizOut = z.object({
  questions: z.array(
    z.object({
      topic: z.string(),
      stem: z.string(),
      options: z.array(z.string()),
      correct_index: z.number().int(),
      explanation: z.string(),
      difficulty: z.number(),
      source_labels: z.array(z.string()),
      evidence_quote: z.string(),
    }),
  ),
});
export const quizJsonSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Topic label, e.g. T1" },
          stem: { type: "string" },
          options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
          correct_index: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string", description: "Why the answer is correct, citing [S#] labels" },
          difficulty: { type: "integer", minimum: 1, maximum: 3 },
          source_labels: { type: "array", items: { type: "string" } },
          evidence_quote: { type: "string", description: "Verbatim sentence copied from the cited passage" },
        },
        required: ["topic", "stem", "options", "correct_index", "explanation", "difficulty", "source_labels", "evidence_quote"],
      },
    },
  },
  required: ["questions"],
};

export const tutorOut = z.object({
  answer_markdown: z.string(),
  source_labels: z.array(z.string()).default([]),
  insufficient_evidence: z.boolean().default(false),
  practice_question: z.string().nullish(),
});
export const tutorJsonSchema = {
  type: "object",
  properties: {
    answer_markdown: { type: "string", description: "Answer in Markdown with inline [S#] citations" },
    source_labels: { type: "array", items: { type: "string" } },
    insufficient_evidence: { type: "boolean" },
    practice_question: { type: "string", description: "Optional follow-up practice question" },
  },
  required: ["answer_markdown", "source_labels", "insufficient_evidence"],
};
