"use client";

import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge, Card, Progress } from "@/components/ui/primitives";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export interface RunnerQuestion {
  id: string;
  stem: string;
  options: string[];
  difficulty: number;
  topic: string;
}

const DIFFICULTY = ["", "Recall", "Conceptual Understanding", "Application"];
const LETTERS = ["A", "B", "C", "D"];

export function QuizRunner({ workspaceId, quizId, questions }: { workspaceId: string; quizId: string; questions: RunnerQuestion[] }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const q = questions[i];
  const answered = Object.keys(answers).length;
  const allAnswered = answered === questions.length;
  const isLast = i === questions.length - 1;

  async function submit() {
    if (!allAnswered) {
      setI(questions.findIndex((x) => answers[x.id] === undefined));
      toast.warning("Please answer all questions before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/api/quizzes/${quizId}/submit`, {
        body: { answers: questions.map((x) => ({ question_id: x.id, selected_index: answers[x.id] })) },
      });
      router.replace(`/w/${workspaceId}/quiz/${quizId}/results`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submission failed. Please try again.");
      setSubmitting(false);
    }
  }

  if (!q) return <p className="text-sm text-muted">This quiz contains no questions.</p>;

  return (
    <div className="mx-auto max-w-2xl py-2">
      <div className="mb-2 flex items-center justify-between gap-4 text-xs">
        <span className="font-semibold text-ink">
          Question {i + 1} <span className="font-normal text-muted">of {questions.length}</span>
        </span>
        <span className="text-muted">{answered} of {questions.length} answered</span>
      </div>
      <Progress value={(answered / questions.length) * 100} className="mb-6" label="Questions answered" />

      <Card className="p-6 sm:p-8">
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge className="border-brand-border bg-brand-soft text-brand-strong">{q.topic}</Badge>
          <Badge className="border-border bg-subtle text-muted">{DIFFICULTY[q.difficulty] ?? "Understanding"}</Badge>
        </div>

        <h2 className="text-lg font-semibold leading-relaxed text-ink sm:text-xl">{q.stem}</h2>

        <fieldset className="mt-6 space-y-2.5">
          <legend className="sr-only">Select your answer choice</legend>
          {q.options.map((opt, idx) => {
            const selected = answers[q.id] === idx;
            return (
              <label
                key={idx}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-sm transition-colors",
                  selected
                    ? "border-brand bg-brand-soft ring-1 ring-brand text-ink"
                    : "border-border bg-surface hover:border-brand-border hover:bg-subtle/50 text-ink",
                )}
              >
                <input
                  type="radio"
                  name={q.id}
                  className="sr-only"
                  checked={selected}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}
                />
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold transition-colors",
                    selected ? "border-brand bg-brand text-white" : "border-border bg-subtle text-muted",
                  )}
                >
                  {LETTERS[idx]}
                </span>
                <span className="pt-0.5 leading-relaxed">{opt}</span>
              </label>
            );
          })}
        </fieldset>
      </Card>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
          <ArrowLeft className="size-4" /> Previous
        </Button>

        <div className="hidden flex-wrap justify-center gap-1.5 sm:flex" aria-label="Jump to question">
          {questions.map((x, idx) => (
            <button
              key={x.id}
              onClick={() => setI(idx)}
              aria-label={`Question ${idx + 1}${answers[x.id] !== undefined ? ", answered" : ""}`}
              aria-current={idx === i ? "step" : undefined}
              className={cn(
                "size-2.5 rounded-full transition-colors cursor-pointer",
                idx === i
                  ? "bg-brand ring-2 ring-brand/25"
                  : answers[x.id] !== undefined
                  ? "bg-brand/50"
                  : "bg-border-strong",
              )}
            />
          ))}
        </div>

        {isLast ? (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Submit answers
          </Button>
        ) : (
          <Button variant={answers[q.id] !== undefined ? "primary" : "secondary"} onClick={() => setI((x) => x + 1)}>
            Next <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
