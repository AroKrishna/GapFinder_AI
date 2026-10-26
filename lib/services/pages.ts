import "server-only";
import { notFound } from "next/navigation";
import { getOwnedWorkspace, requirePageUser } from "./auth";
import { HttpError } from "./http";

/** Every workspace page re-checks auth + ownership itself (pages render in parallel with layouts). */
export async function loadWorkspacePage(params: Promise<{ wid: string }>) {
  const { wid } = await params;
  const { supabase, userId } = await requirePageUser();
  try {
    const ws = await getOwnedWorkspace(supabase, userId, wid);
    return { supabase, userId, ws };
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
}
