import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm", className)}>
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="6" />
        <path d="M15.5 15.5l4.5 4.5" />
        <path d="M8.5 11h5" />
      </svg>
    </span>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-lg font-display text-[16px] font-semibold tracking-tight text-ink hover:opacity-95 transition-opacity", className)}>
      <LogoMark />
      <span>
        GapFinder <span className="font-medium text-brand">AI</span>
      </span>
    </Link>
  );
}
