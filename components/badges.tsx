import { AlertTriangle, CheckCircle2, CircleDashed, FlaskConical, Loader2, TrendingUp, XCircle } from "lucide-react";
import type { MasteryState } from "@/lib/core/types";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/primitives";

/**
 * Modern Academic Minimalism learning-status tokens.
 * Consistent status colors & labels across the application:
 * - Strong: #16845B on #EAF7F0
 * - Developing: #A66A0A on #FFF5DE
 * - Needs practice: #C34848 on #FFF0F0
 * - Not assessed: #64748B on #F1F5F9
 * Status is never communicated by color alone.
 */
export const MASTERY_META: Record<MasteryState, { label: string; cls: string; dot: string; hex: string; bar: string }> = {
  weak: { label: "Needs practice", cls: "bg-[#FFF0F0] text-[#C34848] border-[#FCDADA]", dot: "bg-[#C34848]", hex: "#C34848", bar: "bg-[#C34848]" },
  developing: { label: "Developing", cls: "bg-[#FFF5DE] text-[#A66A0A] border-[#FCE8BD]", dot: "bg-[#A66A0A]", hex: "#A66A0A", bar: "bg-[#A66A0A]" },
  strong: { label: "Strong", cls: "bg-[#EAF7F0] text-[#16845B] border-[#C8EED9]", dot: "bg-[#16845B]", hex: "#16845B", bar: "bg-[#16845B]" },
  not_assessed: { label: "Not assessed", cls: "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]", dot: "bg-[#94A3B8]", hex: "#64748B", bar: "bg-[#94A3B8]" },
};

const ICONS: Record<MasteryState, typeof AlertTriangle> = {
  weak: AlertTriangle,
  developing: TrendingUp,
  strong: CheckCircle2,
  not_assessed: CircleDashed,
};

export function MasteryBadge({ state, provisional, className }: { state: MasteryState; provisional?: boolean; className?: string }) {
  const m = MASTERY_META[state];
  const Icon = ICONS[state];
  return (
    <Badge className={cn(m.cls, className)}>
      <Icon className="size-3" aria-hidden />
      {m.label}
      {provisional && state !== "not_assessed" && <span className="font-normal opacity-85">· early estimate</span>}
    </Badge>
  );
}

export function SampleBadge({ className }: { className?: string }) {
  return (
    <Badge className={cn("border-brand-border bg-brand-soft text-brand-strong", className)} title="Sample study material, processed live by the real AI pipeline">
      <FlaskConical className="size-3" aria-hidden /> Sample
    </Badge>
  );
}

export type DocStatus = "pending" | "processing" | "ready" | "failed";

/** Plain-language document states: Waiting · Processing · Ready · Needs attention. */
export function StatusPill({ status }: { status: DocStatus }) {
  const map = {
    pending: { cls: "bg-subtle text-muted border-border", label: "Waiting", icon: CircleDashed },
    processing: { cls: "bg-brand-soft text-brand-strong border-brand-border", label: "Processing", icon: Loader2 },
    ready: { cls: "bg-[#EAF7F0] text-[#16845B] border-[#C8EED9]", label: "Ready", icon: CheckCircle2 },
    failed: { cls: "bg-[#FFF0F0] text-[#C34848] border-[#FCDADA]", label: "Needs attention", icon: XCircle },
  }[status];
  const Icon = map.icon;
  return (
    <Badge className={map.cls}>
      <Icon className={cn("size-3", status === "processing" && "animate-spin")} aria-hidden />
      {map.label}
    </Badge>
  );
}

/** Stacked bar of topic counts by state, with a text legend (identity never by colour alone). */
export function MasteryMix({ counts, className }: { counts: Record<MasteryState, number>; className?: string }) {
  const order: MasteryState[] = ["strong", "developing", "weak", "not_assessed"];
  const total = order.reduce((s, k) => s + counts[k], 0);
  return (
    <div className={className}>
      <div
        className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-subtle"
        role="img"
        aria-label={order.map((k) => `${counts[k]} ${MASTERY_META[k].label.toLowerCase()}`).join(", ")}
      >
        {total > 0 &&
          order.filter((k) => counts[k] > 0).map((k) => (
            <div key={k} className={cn("h-full first:rounded-l-full last:rounded-r-full", MASTERY_META[k].bar)} style={{ width: `${(counts[k] / total) * 100}%` }} />
          ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
        {order.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-full", MASTERY_META[k].dot)} aria-hidden />
            <span className="text-muted">{MASTERY_META[k].label}</span>
            <span className="ml-auto font-semibold tabular-nums text-ink sm:ml-0">{counts[k]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
