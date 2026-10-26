import type { MasteryState, TaskActivity } from "@/lib/core/types";

export interface FocusInput {
  readyDocs: number;
  topicCount: number;
  pendingQuizId: string | null;
  pendingQuizSize: number;
  submittedQuizzes: number;
  hasPlan: boolean;
  nextTask: { topic_id: string | null; topic_name: string; activity: TaskActivity; reason: string; minutes: number } | null;
  weakest: { id: string; name: string; state: MasteryState } | null;
}

export type FocusAction =
  | { kind: "materials" }
  | { kind: "build_topics" }
  | { kind: "continue_quiz"; quizId: string }
  | { kind: "first_quiz" }
  | { kind: "task"; topicId: string | null; activity: TaskActivity }
  | { kind: "make_plan" }
  | { kind: "practice"; topicId: string }
  | { kind: "new_quiz" };

export interface Focus {
  title: string;
  why: string;
  action: FocusAction;
}

const TASK_VERB: Record<TaskActivity, string> = {
  read: "Re-read",
  tutor: "Ask the tutor about",
  practice: "Practise",
  assess: "Check your level in",
  review: "Quick review of",
};

/** Deterministic "what should I do next?" from persisted state — one clear action. */
export function pickFocus(s: FocusInput): Focus {
  if (!s.readyDocs) {
    return { title: "Add your study material", why: "Upload a syllabus, notes or past papers. Everything else is built from them.", action: { kind: "materials" } };
  }
  if (!s.topicCount) {
    return { title: "Find the topics in your material", why: `${s.readyDocs} document${s.readyDocs === 1 ? " is" : "s are"} ready. We'll map out the topics they cover.`, action: { kind: "build_topics" } };
  }
  if (s.pendingQuizId) {
    return { title: "Finish your quiz", why: `You have a ${s.pendingQuizSize}-question quiz waiting. Your answers decide which topics need attention.`, action: { kind: "continue_quiz", quizId: s.pendingQuizId } };
  }
  if (!s.submittedQuizzes) {
    return { title: "Take a short check-in quiz", why: "A few questions from your own material show which topics you know and which need practice.", action: { kind: "first_quiz" } };
  }
  if (s.nextTask) {
    return {
      title: `${TASK_VERB[s.nextTask.activity]} ${s.nextTask.topic_name}`,
      why: s.nextTask.reason,
      action: { kind: "task", topicId: s.nextTask.topic_id, activity: s.nextTask.activity },
    };
  }
  if (!s.hasPlan) {
    return { title: "Make your revision plan", why: "We'll turn your results into a day-by-day plan that fits your exam date and study hours.", action: { kind: "make_plan" } };
  }
  if (s.weakest && s.weakest.state === "weak") {
    return { title: `Practise ${s.weakest.name}`, why: "This is your weakest topic right now. A short quiz will show if it's improving.", action: { kind: "practice", topicId: s.weakest.id } };
  }
  return { title: "Check your progress", why: "You're up to date. A fresh quiz keeps your topic estimates current.", action: { kind: "new_quiz" } };
}
