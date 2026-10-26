import { requireApiUser } from "@/lib/services/auth";
import { handle } from "@/lib/services/http";
import { submitQuiz } from "@/lib/services/quiz";
import { submitInput, uuid } from "@/lib/services/validation";

export async function POST(req: Request, ctx: RouteContext<"/api/quizzes/[qid]/submit">) {
  return handle(async () => {
    const { supabase } = await requireApiUser();
    const quizId = uuid.parse((await ctx.params).qid);
    const input = submitInput.parse(await req.json());
    const res = await submitQuiz(supabase, quizId, input.answers);
    return { quiz_id: res.quiz_id, workspace_id: res.workspace_id, correct: res.correct, total: res.total, score: res.score };
  });
}
