import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/services/auth";
import { getDisplayName } from "@/lib/services/profile";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const { supabase, email, userId } = await requirePageUser();
  const name = await getDisplayName(supabase, userId, email);
  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/workspaces">My subjects</BackLink>
      <PageHeader
        eyebrow="Profile"
        title="Account Details"
        description="Exam dates and study hours are configured separately for each subject within that subject's settings."
      />
      <Card className="divide-y divide-border">
        <Row label="Full Name" value={name} />
        <Row label="Email Address" value={email ?? "—"} />
      </Card>
      <Card className="mt-4 flex gap-3 p-5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#16845B]" aria-hidden />
        <p className="text-xs leading-relaxed text-muted">
          <span className="font-semibold text-ink">Private &amp; isolated workspace.</span> Your study materials, quiz attempts, and learning gap analyses are restricted strictly to your account using row-level security and private storage buckets.
        </p>
      </Card>
      <form action="/auth/signout" method="post" className="mt-6">
        <button className="rounded-md text-xs font-semibold text-[#C34848] hover:underline cursor-pointer">
          Sign out of account
        </button>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 p-4 sm:grid-cols-[140px_1fr] sm:px-5">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="text-xs text-ink">{value}</div>
    </div>
  );
}
