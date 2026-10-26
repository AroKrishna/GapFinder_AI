import { MASTERY } from "./config";
import type { MasteryState } from "./types";

export interface GradedResponse {
  topic_id: string;
  question_id: string;
  quiz_id: string;
  is_correct: boolean;
  difficulty: number;
  answered_at: Date;
}

export interface TopicMastery {
  topic_id: string;
  score: number;
  n_questions: number;
  n_correct: number;
  state: MasteryState;
  provisional: boolean;
  reasons: string[];
  wrong_question_ids: string[];
  right_question_ids: string[];
}

export function classify(score: number, n: number, cfg = MASTERY): MasteryState {
  if (n < cfg.minQuestions) return "not_assessed";
  if (score < cfg.weakBelow) return "weak";
  if (score < cfg.strongAtOrAbove) return "developing";
  return "strong";
}

const DAY = 86_400_000;

/**
 * Evidence-weighted mastery per topic.
 *   w     = difficultyWeight(d) × 0.5^(ageDays / halfLifeDays)
 *   score = (Σ w·correct + 1) / (Σ w + 2)        — Beta(1,1) smoothing
 * Smoothing means a single answer can never yield 0% or 100%, and the
 * minQuestions gate keeps thin evidence in the "not_assessed" bucket.
 */
export function computeTopicMastery(
  topicId: string,
  responses: GradedResponse[],
  now: Date = new Date(),
  cfg = MASTERY,
): TopicMastery {
  const rs = responses.filter((r) => r.topic_id === topicId);
  const n = rs.length;
  const nCorrect = rs.filter((r) => r.is_correct).length;
  let wSum = 0;
  let wCorrect = 0;
  for (const r of rs) {
    const age = Math.max(0, (now.getTime() - r.answered_at.getTime()) / DAY);
    const w = (cfg.difficultyWeight[r.difficulty] ?? 1) * Math.pow(0.5, age / cfg.halfLifeDays);
    wSum += w;
    if (r.is_correct) wCorrect += w;
  }
  const score = n ? (wCorrect + 1) / (wSum + 2) : 0;
  const state = classify(score, n, cfg);
  const provisional = n < cfg.provisionalBelow;

  const reasons: string[] = [];
  if (n === 0) {
    reasons.push("No quiz questions answered on this topic yet.");
  } else {
    const quizzes = new Set(rs.map((r) => r.quiz_id)).size;
    reasons.push(`${nCorrect} of ${n} correct across ${quizzes} quiz${quizzes === 1 ? "" : "zes"}.`);
    if (n < cfg.minQuestions) {
      reasons.push(`Only ${n} answer so far — at least ${cfg.minQuestions} are needed before we judge this topic.`);
    }
    const hard = rs.filter((r) => r.difficulty === 3);
    const hardWrong = hard.filter((r) => !r.is_correct).length;
    if (hard.length && hardWrong === hard.length) reasons.push(`Missed all ${hard.length} harder question(s).`);
    else if (hard.length && hardWrong === 0) reasons.push(`Answered all ${hard.length} harder question(s) correctly.`);
    const easyWrong = rs.filter((r) => r.difficulty === 1 && !r.is_correct).length;
    if (easyWrong) reasons.push(`Missed ${easyWrong} foundational question(s) — revisit the basics.`);

    // Trend: latest quiz vs. earlier quizzes on this topic.
    const byQuiz = new Map<string, { t: number; c: number; n: number }>();
    for (const r of rs) {
      const q = byQuiz.get(r.quiz_id) ?? { t: r.answered_at.getTime(), c: 0, n: 0 };
      q.n++;
      if (r.is_correct) q.c++;
      q.t = Math.max(q.t, r.answered_at.getTime());
      byQuiz.set(r.quiz_id, q);
    }
    const ordered = [...byQuiz.values()].sort((a, b) => a.t - b.t);
    if (ordered.length >= 2) {
      const last = ordered[ordered.length - 1];
      const prev = ordered.slice(0, -1).reduce((acc, q) => ({ c: acc.c + q.c, n: acc.n + q.n }), { c: 0, n: 0 });
      const delta = last.c / last.n - prev.c / prev.n;
      if (delta >= 0.2) reasons.push("Improving: your latest quiz beat your earlier attempts.");
      else if (delta <= -0.2) reasons.push("Declining: your latest quiz was weaker than earlier attempts.");
    }
    if (n >= cfg.minQuestions && provisional) {
      reasons.push(`Early estimate — based on ${n} answers; ${cfg.provisionalBelow}+ give a firmer picture.`);
    }
  }

  return {
    topic_id: topicId,
    score,
    n_questions: n,
    n_correct: nCorrect,
    state,
    provisional,
    reasons,
    wrong_question_ids: rs.filter((r) => !r.is_correct).map((r) => r.question_id),
    right_question_ids: rs.filter((r) => r.is_correct).map((r) => r.question_id),
  };
}
