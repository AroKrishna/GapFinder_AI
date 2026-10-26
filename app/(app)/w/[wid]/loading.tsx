import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading workspace…</span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-64 max-w-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-44 lg:col-span-2 rounded-[var(--radius-card)]" />
        <Skeleton className="h-44 rounded-[var(--radius-card)]" />
        <Skeleton className="h-56 lg:col-span-2 rounded-[var(--radius-card)]" />
        <Skeleton className="h-56 rounded-[var(--radius-card)]" />
      </div>
    </div>
  );
}
