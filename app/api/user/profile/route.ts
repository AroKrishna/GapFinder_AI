import { z } from "zod";
import { requireApiUser } from "@/lib/services/auth";
import { handle } from "@/lib/services/http";
import { getDisplayName, updateDisplayName, validateProfileName } from "@/lib/services/profile";

const patchProfileSchema = z.object({
  name: z.string(),
});

export async function GET() {
  return handle(async () => {
    const { supabase, userId } = await requireApiUser();
    const { data: claims } = await supabase.auth.getClaims();
    const email = (claims?.claims?.email as string | undefined) ?? null;
    const name = await getDisplayName(supabase, userId, email);

    return { name, email };
  });
}

export async function PATCH(req: Request) {
  return handle(async () => {
    const { supabase, userId } = await requireApiUser();
    const rawBody = await req.json();
    const body = patchProfileSchema.parse(rawBody);

    const validation = validateProfileName(body.name);
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    const updatedName = await updateDisplayName(supabase, userId, validation.name);

    return { ok: true, name: updatedName };
  });
}
