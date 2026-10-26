import "server-only";
import type { Supabase } from "@/lib/supabase/server";

/** Friendly display name: profile name, else the part of the email before "@". */
export async function getDisplayName(supabase: Supabase, userId: string, email: string | null): Promise<string> {
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return data?.display_name?.trim() || email?.split("@")[0] || "Student";
}
