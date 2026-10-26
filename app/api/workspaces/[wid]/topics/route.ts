import { getOwnedWorkspace, logActivity, requireApiUser } from "@/lib/services/auth";
import { handle } from "@/lib/services/http";
import { enforceRateLimit } from "@/lib/services/rateLimit";
import { extractTopics } from "@/lib/services/topics";

export const maxDuration = 60;

export async function POST(_req: Request, ctx: RouteContext<"/api/workspaces/[wid]/topics">) {
  return handle(async () => {
    const { supabase, userId } = await requireApiUser();
    const ws = await getOwnedWorkspace(supabase, userId, (await ctx.params).wid);
    await enforceRateLimit(supabase, "topics");
    const res = await extractTopics(supabase, ws.id);
    await logActivity(supabase, ws.id, "topics_built", `Topic map built with ${res.topic_count} topics`);
    return res;
  });
}
