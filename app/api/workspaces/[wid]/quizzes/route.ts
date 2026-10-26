import { getOwnedWorkspace, requireApiUser } from "@/lib/services/auth";
import { handle } from "@/lib/services/http";
import { generateQuiz } from "@/lib/services/quiz";
import { enforceRateLimit } from "@/lib/services/rateLimit";
import { quizInput } from "@/lib/services/validation";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/workspaces/[wid]/quizzes">) {
  return handle(async () => {
    const { supabase, userId } = await requireApiUser();
    const ws = await getOwnedWorkspace(supabase, userId, (await ctx.params).wid);
    const input = quizInput.parse(await req.json().catch(() => ({})));
    await enforceRateLimit(supabase, "quiz");
    return generateQuiz(supabase, ws.id, input.topic_ids);
  });
}
