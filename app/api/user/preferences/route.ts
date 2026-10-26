import { z } from "zod";
import { requireApiUser } from "@/lib/services/auth";
import { handle } from "@/lib/services/http";

const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
});

export async function PATCH(req: Request) {
  return handle(async () => {
    const { supabase, userId } = await requireApiUser();
    const body = preferencesSchema.parse(await req.json());

    // Safely update profile with user's theme preference
    const { error } = await supabase
      .from("profiles")
      .update({ theme: body.theme } as Record<string, unknown>)
      .eq("id", userId);

    if (error) {
      // If profile record didn't exist yet, try upserting
      await supabase
        .from("profiles")
        .upsert({ id: userId, theme: body.theme } as Record<string, unknown>);
    }

    return { ok: true, theme: body.theme };
  });
}

export async function GET() {
  return handle(async () => {
    const { supabase, userId } = await requireApiUser();
    const { data } = await supabase
      .from("profiles")
      .select("theme" as string)
      .eq("id", userId)
      .maybeSingle();

    return { theme: (data as { theme?: string } | null)?.theme ?? "light" };
  });
}
