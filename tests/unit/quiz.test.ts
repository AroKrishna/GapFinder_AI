import { describe, expect, it } from "vitest";
import { labelSources } from "@/lib/core/citations";
import { validateQuestions, type DraftQuestion } from "@/lib/core/quizValidate";
import { scoreQuiz } from "@/lib/core/scoring";
import type { RetrievedChunk } from "@/lib/core/types";

const passage =
  "FIFO suffers from Belady's anomaly: for some reference strings, increasing the number of frames increases the number of page faults.";
const chunk: RetrievedChunk = { id: "c1", document_id: "d", document_title: "Notes", content: passage, page: 2, heading: "Page Replacement", similarity: 0.8, score: 0.03 };
const topicLabels = new Map([["T1", "topic-1"]]);
const sourcesByTopic = new Map([["topic-1", labelSources([chunk])]]);

const good: DraftQuestion = {
  topic: "T1",
  stem: "Which page replacement algorithm can suffer from Belady's anomaly?",
  options: ["FIFO", "LRU", "Optimal", "None of these"],
  correct_index: 0,
  explanation: "FIFO can incur more faults with more frames [S1].",
  difficulty: 2,
  source_labels: ["S1"],
  evidence_quote: "FIFO suffers from Belady's anomaly",
};

describe("validateQuestions", () => {
  it("accepts a well-formed, grounded question and maps labels to chunk ids", () => {
    const { valid, rejected } = validateQuestions([good], topicLabels, sourcesByTopic);
    expect(rejected).toEqual([]);
    expect(valid[0]).toMatchObject({ topic_id: "topic-1", correct_index: 0, source_chunk_ids: ["c1"], difficulty: 2 });
  });

  it.each([
    ["unknown topic", { topic: "T9" }],
    ["needs exactly 4 non-empty options", { options: ["A", "B", "C"] }],
    ["options are not distinct", { options: ["FIFO", "fifo", "LRU", "Optimal"] }],
    ["correct_index out of range", { correct_index: 4 }],
    ["cites no retrieved passage", { source_labels: ["S5"] }],
    ["evidence quote not found in cited passage", { evidence_quote: "LRU always beats FIFO on every reference string" }],
    ["missing explanation", { explanation: "  " }],
  ])("rejects: %s", (reason, patch) => {
    const { valid, rejected } = validateQuestions([{ ...good, ...patch } as DraftQuestion], topicLabels, sourcesByTopic);
    expect(valid).toHaveLength(0);
    expect(rejected[0].reason).toBe(reason);
  });

  it("rejects duplicates and clamps bad difficulty", () => {
    const { valid, rejected } = validateQuestions([{ ...good, difficulty: 9 }, good], topicLabels, sourcesByTopic);
    expect(valid).toHaveLength(1);
    expect(valid[0].difficulty).toBe(2);
    expect(rejected[0].reason).toBe("duplicate question");
  });
});

describe("scoreQuiz", () => {
  const qs = [{ id: "q1", correct_index: 0 }, { id: "q2", correct_index: 3 }, { id: "q3", correct_index: 1 }];
  it("scores deterministically against the key", () => {
    const r = scoreQuiz(qs, new Map([["q1", 0], ["q2", 2], ["q3", 1]]));
    expect(r.correct).toBe(2);
    expect(r.total).toBe(3);
    expect(r.score).toBeCloseTo(2 / 3);
    expect(r.results.map((x) => x.is_correct)).toEqual([true, false, true]);
  });
  it("treats unanswered as incorrect and handles empty quizzes", () => {
    expect(scoreQuiz(qs, new Map()).correct).toBe(0);
    expect(scoreQuiz([], new Map()).score).toBe(0);
  });
});
