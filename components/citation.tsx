"use client";

import { FileText, X } from "lucide-react";
import { useId, useState } from "react";
import type { Citation } from "@/lib/core/types";
import { cn } from "@/lib/utils";

export function citationLabel(c: Pick<Citation, "document_title" | "page" | "heading">) {
  return [c.document_title.replace(/^SAMPLE — /, ""), c.page ? `p. ${c.page}` : null, c.heading ? c.heading : null]
    .filter(Boolean)
    .join(" · ");
}

/** Readable source chip; click to reveal the exact passage from the student's material. */
export function CitationChip({ citation, index, className }: { citation: Citation; index?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <span className={cn("inline-block max-w-full align-top", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-left text-xs text-muted transition-colors hover:border-brand-border hover:bg-brand-soft hover:text-ink cursor-pointer"
      >
        {index !== undefined && <span className="font-semibold text-brand">[{index}]</span>}
        <FileText className="size-3.5 shrink-0 text-faint" aria-hidden />
        <span className="truncate">{citationLabel(citation)}</span>
      </button>
      {open && (
        <span id={panelId} className="mt-1.5 block rounded-lg border border-border bg-surface p-3.5 text-[13px] leading-relaxed text-ink shadow-[var(--shadow-card)]">
          <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-muted">
            Source passage from material
            <button type="button" onClick={() => setOpen(false)} aria-label="Close passage" className="rounded p-0.5 text-faint hover:text-ink cursor-pointer">
              <X className="size-3.5" />
            </button>
          </span>
          <span className="whitespace-pre-line text-ink-secondary">{citation.excerpt}</span>
        </span>
      )}
    </span>
  );
}

export function CitationList({ citations, numbered }: { citations: Citation[]; numbered?: boolean }) {
  if (!citations.length) return null;
  return (
    <div className="flex flex-col items-start gap-1.5">
      {citations.map((c, i) => (
        <CitationChip key={c.chunk_id + i} citation={c} index={numbered ? i + 1 : undefined} />
      ))}
    </div>
  );
}
