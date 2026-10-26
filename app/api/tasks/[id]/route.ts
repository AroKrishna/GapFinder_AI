import { logActivity, requireApiUser } from "@/lib/services/auth";
import { check, handle, notFound } from "@/lib/services/http";
import { taskInput, uuid } from "@/lib/services/validation";

export async function PATCH(req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  return handle(async () => {
    const { supabase } = await requireApiUser();
    const id = uuid.parse((await ctx.params).id);
    const { done } = taskInput.parse(await req.json());
    const rows = check(
      await supabase
        .from("revision_tasks")
        .update({ done, done_at: done ? new Date().toISOString() : null })
        .eq("id", id)
        .select("id, workspace_id, topic_name, activity"),
      "Update task",
    );
    if (!rows.length) throw notFound("Task");
    if (done) await logActivity(supabase, rows[0].workspace_id, "task_done", `Completed: ${rows[0].topic_name} (${rows[0].activity})`);
    return { ok: true };
  });
}
