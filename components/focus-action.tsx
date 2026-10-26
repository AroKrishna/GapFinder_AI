import { ArrowRight, BookOpen, MessageSquareText } from "lucide-react";
import { BuildTopicsButton, GeneratePlanButton, GenerateQuizButton } from "@/components/topic-actions";
import { LinkButton } from "@/components/ui/button";
import type { FocusAction } from "@/lib/services/focus";

/** Renders the single primary action for a Focus recommendation. */
export function FocusActionButton({ action, workspaceId, size = "lg" }: { action: FocusAction; workspaceId: string; size?: "md" | "lg" }) {
  const base = `/w/${workspaceId}`;
  switch (action.kind) {
    case "materials":
      return <LinkButton href={`${base}/documents`} size={size}><BookOpen /> Add material</LinkButton>;
    case "build_topics":
      return <BuildTopicsButton workspaceId={workspaceId} size={size} />;
    case "continue_quiz":
      return <LinkButton href={`${base}/quiz/${action.quizId}`} size={size}>Continue quiz <ArrowRight /></LinkButton>;
    case "first_quiz":
    case "new_quiz":
      return <GenerateQuizButton workspaceId={workspaceId} size={size} label={action.kind === "first_quiz" ? "Start check-in quiz" : "Take a quick quiz"} />;
    case "make_plan":
      return <GeneratePlanButton workspaceId={workspaceId} size={size} />;
    case "practice":
      return <GenerateQuizButton workspaceId={workspaceId} topicIds={[action.topicId]} size={size} label="Practise this topic" />;
    case "task":
      if ((action.activity === "practice" || action.activity === "assess") && action.topicId) {
        return <GenerateQuizButton workspaceId={workspaceId} topicIds={[action.topicId]} size={size} label={action.activity === "assess" ? "Start topic quiz" : "Practise this topic"} />;
      }
      if (action.activity === "tutor" && action.topicId) {
        return <LinkButton href={`${base}/tutor?topic=${action.topicId}`} size={size}><MessageSquareText /> Ask AI Tutor</LinkButton>;
      }
      return <LinkButton href={`${base}/plan`} size={size}>Open today&apos;s revision <ArrowRight /></LinkButton>;
  }
}
