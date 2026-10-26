import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { AccountProfileCard } from "@/components/account-profile-card";
import { BackLink } from "@/components/back-link";
import { BrandingSettings } from "@/components/branding-settings";
import { ThemeSelector } from "@/components/theme-selector";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/services/auth";
import { getDisplayName } from "@/lib/services/profile";

export const metadata: Metadata = { title: "Settings & Profile" };

export default async function AccountPage() {
  const { supabase, email, userId } = await requirePageUser();
  const name = await getDisplayName(supabase, userId, email);

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href="/workspaces">My subjects</BackLink>
      <PageHeader
        eyebrow="Settings"
        title="Settings &amp; Profile"
        description="Configure your personal profile, application branding, and appearance preferences."
      />

      <div className="space-y-6">
        {/* Account Profile Section (Editable full name, read-only email) */}
        <AccountProfileCard initialName={name} email={email} />

        {/* Application Branding Section */}
        <Card className="p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-ink">Application Branding</h2>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Personalize the application name and upload a custom logo. Branding updates apply seamlessly across all pages, navigation, and browser tabs.
            </p>
          </div>
          <BrandingSettings />
        </Card>

        {/* Appearance & Theme Section */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink">Appearance &amp; Theme</h2>
          <p className="mb-4 mt-1 text-xs text-muted leading-relaxed">
            Choose your preferred color theme. Light Mode is active by default. You can switch to Dark Mode or synchronize with your operating system.
          </p>
          <ThemeSelector />
        </Card>

        {/* Security & Isolation */}
        <Card className="flex gap-3 p-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-strong" aria-hidden />
          <p className="text-xs leading-relaxed text-muted">
            <span className="font-semibold text-ink">Private &amp; isolated workspace.</span> Your study materials, quiz attempts, and learning gap analyses are restricted strictly to your account using row-level security and private storage buckets.
          </p>
        </Card>

        {/* Sign out */}
        <form action="/auth/signout" method="post">
          <button className="rounded-md text-xs font-semibold text-weak hover:underline cursor-pointer">
            Sign out of account
          </button>
        </form>
      </div>
    </div>
  );
}
