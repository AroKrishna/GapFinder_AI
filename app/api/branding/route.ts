import { z } from "zod";
import { DEFAULT_APP_NAME, validateAppName } from "@/lib/branding";
import { requireApiUser } from "@/lib/services/auth";
import { handle } from "@/lib/services/http";
import { createClient } from "@/lib/supabase/server";

const patchBrandingSchema = z.object({
  appName: z.string().optional(),
  logoUrl: z.string().nullable().optional(),
});

export async function GET() {
  return handle(async () => {
    try {
      const supabase = await createClient();
      // Try global branding table first
      const { data: globalData } = await supabase
        .from("app_branding")
        .select("app_name, logo_url")
        .eq("id", "default")
        .maybeSingle();

      if (globalData?.app_name) {
        return {
          app_name: globalData.app_name,
          logo_url: globalData.logo_url ?? null,
        };
      }

      // Check current user's profile if signed in
      const { data: claims } = await supabase.auth.getClaims();
      const userId = claims?.claims?.sub;
      if (userId) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("app_name, logo_url")
          .eq("id", userId)
          .maybeSingle();

        if (profData?.app_name) {
          return {
            app_name: profData.app_name,
            logo_url: profData.logo_url ?? null,
          };
        }
      }
    } catch {
      // Graceful fallback when database is not yet migrated or offline
    }

    return {
      app_name: DEFAULT_APP_NAME,
      logo_url: null,
    };
  });
}

export async function PATCH(req: Request) {
  return handle(async () => {
    const { supabase, userId } = await requireApiUser();
    const body = patchBrandingSchema.parse(await req.json());

    let finalName = DEFAULT_APP_NAME;
    if (body.appName !== undefined) {
      const val = validateAppName(body.appName);
      if (!val.valid) {
        return { ok: false, error: val.error };
      }
      finalName = val.name;
    }

    const finalLogo = body.logoUrl !== undefined ? body.logoUrl : null;

    // 1. Persist to global app_branding table
    try {
      await supabase.from("app_branding").upsert({
        id: "default",
        app_name: finalName,
        logo_url: finalLogo,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Failed saving to app_branding, continuing with profile fallback:", err);
    }

    // 2. Persist to user profile as fallback
    try {
      await supabase
        .from("profiles")
        .update({
          app_name: finalName,
          logo_url: finalLogo,
        } as Record<string, unknown>)
        .eq("id", userId);
    } catch (err) {
      console.warn("Failed saving branding to profile:", err);
    }

    return {
      ok: true,
      app_name: finalName,
      logo_url: finalLogo,
    };
  });
}
