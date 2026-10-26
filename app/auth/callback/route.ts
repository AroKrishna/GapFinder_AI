import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Handles email-confirmation links (only used if "Confirm email" is enabled in Supabase). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/workspaces", req.url));
}
