import { getOwnedWorkspace, requireApiUser } from "@/lib/services/auth";
import { check, handle } from "@/lib/services/http";
import { documentInput, safeFilename } from "@/lib/services/validation";

/**
 * Step 1 of upload: validate metadata and reserve a storage path inside the caller's
 * folder. The browser then uploads the file directly to Supabase Storage (RLS-protected),
 * so large files never pass through a serverless request body.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const { supabase, userId } = await requireApiUser();
    const input = documentInput.parse(await req.json());
    const ws = await getOwnedWorkspace(supabase, userId, input.workspace_id);
    const storage_path = `${userId}/${ws.id}/${crypto.randomUUID()}-${safeFilename(input.filename)}`;
    const doc = check(
      await supabase
        .from("documents")
        .insert({ workspace_id: ws.id, title: input.title, storage_path, mime: input.mime, size_bytes: input.size })
        .select("id")
        .single(),
      "Create document",
    );
    return { document_id: doc.id, storage_path };
  });
}
