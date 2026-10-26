import { getOwnedWorkspace, requireApiUser } from "@/lib/services/auth";
import { handle } from "@/lib/services/http";
import { generatePlan } from "@/lib/services/plan";

export async function POST(_req: Request, ctx: RouteContext<"/api/workspaces/[wid]/plan">) {
  return handle(async () => {
    const { supabase, userId } = await requireApiUser();
    const ws = await getOwnedWorkspace(supabase, userId, (await ctx.params).wid);
    return generatePlan(supabase, ws);
  });
}
