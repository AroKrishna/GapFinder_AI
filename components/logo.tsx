"use client";

import Link from "next/link";
import { useState } from "react";
import { useBranding } from "@/components/branding-provider";
import { cn } from "@/lib/utils";

/**
 * Redesigned GapFinder AI Geometric Logo Symbol:
 * - Left and right knowledge nodes separated by a learning gap
 * - Elevated connecting bridge uniting the nodes
 * - Radiant central AI discovery spark rising up at the focal breakthrough point
 * - Built purely with crisp vector geometry for pixel-perfect scalability
 */
export function GapFinderSymbol({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-[18px]", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gf-sym-spark" x1="10" y1="4" x2="14" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      {/* Left knowledge node */}
      <circle cx="7" cy="14" r="1.75" fill="currentColor" />
      {/* Right knowledge node */}
      <circle cx="17" cy="14" r="1.75" fill="currentColor" />
      {/* Knowledge gap bridge arc */}
      <path
        d="M 7 14 C 7 18.2, 17 18.2, 17 14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Discovery beam from center of gap */}
      <path d="M 12 16.5 V 13" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" />
      {/* AI Breakthrough focal spark */}
      <path
        d="M 12 5.5 L 13.1 8.2 L 16 9 L 13.1 9.8 L 12 12.5 L 10.9 9.8 L 8 9 L 10.9 8.2 Z"
        fill="url(#gf-sym-spark)"
      />
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  const { logoUrl, appName } = useBranding();
  const [imageFailed, setImageFailed] = useState(false);

  // If a custom logo URL is configured and hasn't errored out, render it
  if (logoUrl && !imageFailed) {
    return (
      <span
        className={cn(
          "relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface shadow-sm",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={`${appName} logo`}
          className="size-full object-contain p-1"
          onError={() => setImageFailed(true)}
        />
      </span>
    );
  }

  // Primary modern geometric mark: cobalt gradient container with white + cyan spark
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-brand text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-150",
        className,
      )}
    >
      <GapFinderSymbol />
    </span>
  );
}

export function Logo({
  className,
  href = "/",
  showName = true,
}: {
  className?: string;
  href?: string;
  showName?: boolean;
}) {
  const { appName } = useBranding();

  // Split name for styled wordmark if ending with AI (e.g. "GapFinder AI" -> "GapFinder" + "AI")
  const endsWithAi = appName.trim().endsWith(" AI");
  const mainPart = endsWithAi ? appName.slice(0, -3).trim() : appName;

  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-lg font-display text-[16px] font-semibold tracking-tight text-ink hover:opacity-95 transition-opacity",
        className,
      )}
    >
      <LogoMark />
      {showName && (
        <span className="truncate">
          {endsWithAi ? (
            <>
              {mainPart} <span className="font-semibold text-brand">AI</span>
            </>
          ) : (
            appName
          )}
        </span>
      )}
    </Link>
  );
}
