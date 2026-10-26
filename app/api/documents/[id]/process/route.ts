import { requireApiUser } from "@/lib/services/auth";
import { handle } from "@/lib/services/http";
import { processDocument } from "@/lib/services/ingest";
import { enforceRateLimit } from "@/lib/services/rateLimit";
import { uuid } from "@/lib/services/validation";

export const maxDuration = 60;

/** Step 2 of upload (also used for Retry): extract, chunk, embed and index. */
export async function POST(_req: Request, ctx: RouteContext<"/api/documents/[id]/process">) {
  return handle(async () => {
    const { supabase } = await requireApiUser();
    await enforceRateLimit(supabase, "process");
    const docId = uuid.parse((await ctx.params).id);
    return processDocument(supabase, docId);
  });
}
