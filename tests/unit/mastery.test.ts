import { describe, expect, it } from "vitest";
import { classify, computeTopicMastery, type GradedResponse } from "@/lib/core/mastery";

const now = new Date("2026-10-26T12:00:00Z");
const r = (correct: boolean, opts: Partial<GradedResponse> = {}): GradedResponse => ({
  topic_id: "t",
  question_id: Math.random().toString(36),
  quiz_id: "q1",
  is_correct: correct,
  difficulty: 2,
  answered_at: now,
  ...opts,
});

describe("classify thresholds", () => {
  it("needs minimum evidence before classifying", () => {
    expect(classify(0.9, 1)).toBe("not_assessed");
    expect(classify(0.4, 2)).toBe("weak");
    expect(classify(0.6, 2)).toBe("developing");
    expect(classify(0.75, 2)).toBe("strong");
  });
});

describe("computeTopicMastery", () => {
  it("does not treat a single answer as proof of mastery", () => {
    const m = computeTopicMastery("t", [r(true)], now);
    expect(m.state).toBe("not_assessed");
    expect(m.score).toBeCloseTo(2 / 3); // (1+1)/(1+2)
    expect(m.reasons.join(" ")).toMatch(/at least 2/);
  });

  it("classifies with smoothing and marks thin evidence provisional", () => {
    const weak = computeTopicMastery("t", [r(false), r(false), r(true)], now);
    expect(weak.state).toBe("weak");
    expect(weak.provisional).toBe(true);
    expect(weak.n_correct).toBe(1);

    const strong = computeTopicMastery("t", Array.from({ length: 6 }, () => r(true)), now);
    expect(strong.state).toBe("strong");
    expect(strong.provisional).toBe(false);
    expect(strong.score).toBeLessThan(1);
  });

  it("weights recent answers more than old ones", () => {
    const old = new Date(now.getTime() - 28 * 86_400_000);
    const improving = computeTopicMastery("t", [r(false, { answered_at: old, quiz_id: "a" }), r(false, { answered_at: old, quiz_id: "a" }), r(true, { quiz_id: "b" }), r(true, { quiz_id: "b" })], now);
    const declining = computeTopicMastery("t", [r(true, { answered_at: old, quiz_id: "a" }), r(true, { answered_at: old, quiz_id: "a" }), r(false, { quiz_id: "b" }), r(false, { quiz_id: "b" })], now);
    expect(improving.score).toBeGreaterThan(declining.score);
    expect(improving.reasons.join(" ")).toMatch(/Improving/);
    expect(declining.reasons.join(" ")).toMatch(/Declining/);
  });

  it("weights harder questions more", () => {
    const hardRight = computeTopicMastery("t", [r(true, { difficulty: 3 }), r(false, { difficulty: 1 })], now);
    const easyRight = computeTopicMastery("t", [r(true, { difficulty: 1 }), r(false, { difficulty: 3 })], now);
    expect(hardRight.score).toBeGreaterThan(easyRight.score);
  });

  it("only uses responses for the requested topic and reports evidence ids", () => {
    const m = computeTopicMastery("t", [r(true, { question_id: "x" }), r(false, { question_id: "y" }), r(true, { topic_id: "other" })], now);
    expect(m.n_questions).toBe(2);
    expect(m.right_question_ids).toEqual(["x"]);
    expect(m.wrong_question_ids).toEqual(["y"]);
  });
});
