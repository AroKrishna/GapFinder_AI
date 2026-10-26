import { requireApiUser } from "@/lib/services/auth";
import { check, handle } from "@/lib/services/http";
import { workspaceInput } from "@/lib/services/validation";

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireApiUser();
    const input = workspaceInput.parse(await req.json());
    const ws = check(await supabase.from("workspaces").insert(input).select("id").single(), "Create workspace");
    return { workspace_id: ws.id };
  });
}
