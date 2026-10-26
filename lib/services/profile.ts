import "server-only";
import { validateProfileName } from "@/lib/services/validation";
import type { Supabase } from "@/lib/supabase/server";

export { validateProfileName, MAX_PROFILE_NAME_LENGTH } from "@/lib/services/validation";

/** Friendly display name: profile name, else the part of the email before "@". */
export async function getDisplayName(supabase: Supabase, userId: string, email: string | null): Promise<string> {
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return data?.display_name?.trim() || email?.split("@")[0] || "Student";
}

/**
 * Updates the authenticated user's display name in both:
 * 1. The dedicated `profiles` table (`display_name`)
 * 2. Supabase Auth user metadata (`raw_user_meta_data.display_name`)
 */
export async function updateDisplayName(supabase: Supabase, userId: string, displayName: string): Promise<string> {
  const validation = validateProfileName(displayName);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  const cleanName = validation.name;

  // 1. Update the profiles table
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: cleanName } as Record<string, unknown>)
    .eq("id", userId);

  if (error) {
    // If profile didn't exist yet, insert it
    await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: cleanName } as Record<string, unknown>);
  }

  // 2. Synchronize Supabase Auth user metadata
  try {
    await supabase.auth.updateUser({
      data: { display_name: cleanName },
    });
  } catch (err) {
    console.warn("Failed updating Supabase auth user metadata:", err);
  }

  return cleanName;
}
