"use client";

import { BookOpen, CalendarCheck, Home, MessageSquareText, Target } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

function useItems(wid: string) {
  const base = `/w/${wid}`;
  return [
    { href: base, label: "Home", short: "Home", icon: Home, match: (p: string) => p === base },
    { href: `${base}/documents`, label: "My Materials", short: "Materials", icon: BookOpen, match: (p: string) => p.startsWith(`${base}/documents`) },
    {
      href: `${base}/gaps`,
      label: "Topic Gaps",
      short: "Topic Gaps",
      icon: Target,
      match: (p: string) => ["/gaps", "/topics", "/quizzes", "/quiz/"].some((s) => p.startsWith(base + s)),
    },
    { href: `${base}/plan`, label: "Today's Revision", short: "Revision", icon: CalendarCheck, match: (p: string) => p.startsWith(`${base}/plan`) },
    { href: `${base}/tutor`, label: "Ask AI Tutor", short: "AI Tutor", icon: MessageSquareText, match: (p: string) => p.startsWith(`${base}/tutor`) },
  ];
}

/** Desktop sidebar navigation. Clean academic style: pale-blue active surface with cobalt text. */
export function SidebarNav({ wid }: { wid: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {useItems(wid).map((it) => {
        const active = it.match(path);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-brand-soft text-brand font-semibold"
                : "text-muted hover:bg-subtle hover:text-ink",
            )}
          >
            <it.icon className={cn("size-[18px] shrink-0", active ? "text-brand" : "text-faint")} aria-hidden />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile bottom tab bar: five destinations, icon + label, accessible touch targets. */
export function MobileTabBar({ wid }: { wid: string }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Workspace navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgba(0,0,0,0.03)] lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {useItems(wid).map((it) => {
          const active = it.match(path);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-brand font-semibold" : "text-muted hover:text-ink",
                )}
              >
                <span className={cn("flex h-7 w-10 items-center justify-center rounded-md transition-colors", active && "bg-brand-soft")}>
                  <it.icon className={cn("size-[18px]", active ? "text-brand" : "text-faint")} aria-hidden />
                </span>
                <span className="truncate">{it.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
