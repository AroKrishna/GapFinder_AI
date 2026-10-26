import type { ReactNode } from "react";
import { AccountMenu } from "@/components/account-menu";
import { Logo } from "@/components/logo";
import { requirePageUser } from "@/lib/services/auth";
import { getDisplayName } from "@/lib/services/profile";

export default async function HubLayout({ children }: { children: ReactNode }) {
  const { supabase, userId, email } = await requirePageUser();
  const name = await getDisplayName(supabase, userId, email);
  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo href="/workspaces" />
          <AccountMenu name={name} email={null} compact />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
