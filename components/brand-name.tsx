"use client";

import { useBranding } from "@/components/branding-provider";

export function BrandName({ fallback = "GapFinder AI" }: { fallback?: string }) {
  const { appName } = useBranding();
  return <>{appName || fallback}</>;
}
