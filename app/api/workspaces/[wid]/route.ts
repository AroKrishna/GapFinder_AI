import { getOwnedWorkspace, requireApiUser } from "@/lib/services/auth";
import { check, checkMaybe, handle } from "@/lib/services/http";
import { workspaceInput } from "@/lib/services/validation";

export async function PATCH(req: Request, ctx: RouteContext<"/api/workspaces/[wid]">) {
  return handle(async () => {
    const { supabase, userId } = await requireApiUser();
    const ws = await getOwnedWorkspace(supabase, userId, (await ctx.params).wid);
    const input = workspaceInput.parse(await req.json());
    checkMaybe(await supabase.from("workspaces").update(input).eq("id", ws.id), "Update workspace");
    return { ok: true };
  });
}

/** Deletes the workspace, its stored files, and (via cascades) every derived row. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/workspaces/[wid]">) {
  return handle(async () => {
    const { supabase, userId } = await requireApiUser();
    const ws = await getOwnedWorkspace(supabase, userId, (await ctx.params).wid);
    const docs = check(await supabase.from("documents").select("storage_path").eq("workspace_id", ws.id), "Load documents");
    if (docs.length) await supabase.storage.from("documents").remove(docs.map((d) => d.storage_path));
    checkMaybe(await supabase.from("workspaces").delete().eq("id", ws.id), "Delete workspace");
    return { ok: true };
  });
}
