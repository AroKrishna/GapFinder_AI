"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PROFILE_CHANGE_EVENT } from "@/components/account-profile-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand border border-brand-border", className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

/** Account row: name, settings link, sign out (a real POST form, works without JS). */
export function AccountMenu({ name: initialName, email, compact }: { name: string; email: string | null; compact?: boolean }) {
  const [name, setName] = useState(initialName);
  const [prevInitialName, setPrevInitialName] = useState(initialName);

  if (prevInitialName !== initialName) {
    setPrevInitialName(initialName);
    setName(initialName);
  }

  useEffect(() => {
    function onProfileChange(e: Event) {
      const customEvent = e as CustomEvent<{ name?: string }>;
      if (customEvent.detail?.name) {
        setName(customEvent.detail.name);
      }
    }
    window.addEventListener(PROFILE_CHANGE_EVENT, onProfileChange);
    return () => window.removeEventListener(PROFILE_CHANGE_EVENT, onProfileChange);
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      <Avatar name={name} />
      {!compact && (
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink">{name}</div>
          {email && <div className="truncate text-xs text-muted">{email}</div>}
        </div>
      )}
      <ThemeToggle className="size-8 border-none bg-transparent p-1.5 text-muted hover:bg-subtle hover:text-ink" />
      <Link href="/settings" className="rounded-lg p-2 text-muted hover:bg-subtle hover:text-ink transition-colors" aria-label="Account settings" title="Account settings">
        <Settings className="size-4" />
      </Link>
      <form action="/auth/signout" method="post">
        <button className="rounded-lg p-2 text-muted hover:bg-subtle hover:text-ink transition-colors cursor-pointer" aria-label="Sign out" title="Sign out">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}
