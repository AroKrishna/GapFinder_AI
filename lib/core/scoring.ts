export interface KeyedQuestion {
  id: string;
  correct_index: number;
}

export interface QuizResult {
  results: { question_id: string; selected_index: number | null; correct_index: number; is_correct: boolean }[];
  correct: number;
  total: number;
  score: number;
}

/** Deterministic answer-key scoring. Unanswered questions count as incorrect. */
export function scoreQuiz(questions: KeyedQuestion[], answers: Map<string, number>): QuizResult {
  const results = questions.map((q) => {
    const sel = answers.has(q.id) ? answers.get(q.id)! : null;
    return { question_id: q.id, selected_index: sel, correct_index: q.correct_index, is_correct: sel === q.correct_index };
  });
  const correct = results.filter((r) => r.is_correct).length;
  const total = questions.length;
  return { results, correct, total, score: total ? correct / total : 0 };
}
