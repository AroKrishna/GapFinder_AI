import "server-only";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient, type Supabase } from "@/lib/supabase/server";
import { HttpError, notFound } from "./http";

export interface Workspace {
  id: string;
  name: string;
  subject: string;
  exam_date: string | null;
  hours_per_day: number;
  is_sample: boolean;
  created_at: string;
}

/** For route handlers: a user-scoped client plus the verified user id, or 401. */
export async function requireApiUser(): Promise<{ supabase: Supabase; userId: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) throw new HttpError(401, "Please sign in");
  return { supabase, userId };
}

/** For server components: redirect to /login when signed out. */
export async function requirePageUser(): Promise<{ supabase: Supabase; userId: string; email: string | null }> {
  if (!isSupabaseConfigured()) redirect("/login"); // login page explains the missing configuration
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  return { supabase, userId, email: (data.claims.email as string | undefined) ?? null };
}

/** Explicit ownership check on top of RLS: the row must exist AND belong to this user. */
export async function getOwnedWorkspace(supabase: Supabase, userId: string, workspaceId: string): Promise<Workspace> {
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) throw notFound("Workspace");
  const { data } = await supabase
    .from("workspaces")
    .select("id, name, subject, exam_date, hours_per_day, is_sample, created_at")
    .eq("id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw notFound("Workspace");
  return { ...data, hours_per_day: Number(data.hours_per_day) } as Workspace;
}

export async function logActivity(supabase: Supabase, workspaceId: string, kind: string, label: string) {
  await supabase.from("study_activity").insert({ workspace_id: workspaceId, kind, label: label.slice(0, 200) });
}
