import { getOwnedWorkspace, requireApiUser } from "@/lib/services/auth";
import { handle } from "@/lib/services/http";
import { enforceRateLimit } from "@/lib/services/rateLimit";
import { askTutor } from "@/lib/services/tutor";
import { tutorInput } from "@/lib/services/validation";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/workspaces/[wid]/tutor">) {
  return handle(async () => {
    const { supabase, userId } = await requireApiUser();
    const ws = await getOwnedWorkspace(supabase, userId, (await ctx.params).wid);
    const input = tutorInput.parse(await req.json());
    await enforceRateLimit(supabase, "tutor");
    return askTutor(supabase, ws.id, input.message, input.topic_id);
  });
}
