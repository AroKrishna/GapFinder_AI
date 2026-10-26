import type { Citation, RetrievedChunk } from "./types";

/** Lowercase, unify quotes/dashes, strip punctuation, collapse whitespace. */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”`"']/g, "")
    .replace(/[–—-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the quote is supported by the passage: an exact normalised substring,
 * or (for longer quotes the model lightly paraphrased) at least 80% of its
 * 5-word shingles appear in the passage.
 */
export function quoteSupported(quote: string, passage: string): boolean {
  const q = normalizeForMatch(quote);
  const p = normalizeForMatch(passage);
  if (q.length < 12) return false;
  if (p.includes(q)) return true;
  const words = q.split(" ");
  if (words.length < 8) return false;
  const n = 5;
  let hit = 0;
  let total = 0;
  for (let i = 0; i + n <= words.length; i++) {
    total++;
    if (p.includes(words.slice(i, i + n).join(" "))) hit++;
  }
  return total > 0 && hit / total >= 0.8;
}

/** Label retrieved chunks S1..Sn so the model cites short labels, never raw ids. */
export function labelSources(chunks: RetrievedChunk[]): Map<string, RetrievedChunk> {
  return new Map(chunks.map((c, i) => [`S${i + 1}`, c]));
}

/** Keep only labels that were actually retrieved; preserves order, drops duplicates. */
export function resolveLabels(labels: string[], sources: Map<string, RetrievedChunk>): RetrievedChunk[] {
  const seen = new Set<string>();
  const out: RetrievedChunk[] = [];
  for (const raw of labels) {
    const label = raw.trim().toUpperCase().replace(/^\[|\]$/g, "");
    const c = sources.get(label);
    if (c && !seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

export function toCitation(c: RetrievedChunk, excerptChars = 280): Citation {
  return {
    chunk_id: c.id,
    document_title: c.document_title,
    page: c.page,
    heading: c.heading,
    excerpt: c.content.length > excerptChars ? c.content.slice(0, excerptChars).trimEnd() + "…" : c.content,
  };
}

// Matches a single label or a group: [S2], [S1, S3], [S1,S2 ,S4]
const LABEL_GROUP = /\[\s*(S\d{1,2}(?:\s*,\s*S\d{1,2})*)\s*\]/g;
const splitGroup = (g: string) => g.split(",").map((s) => s.trim());

/** Labels like [S2] or [S1, S3] that appear inline in generated prose. */
export function extractInlineLabels(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(LABEL_GROUP), (m) => splitGroup(m[1])).flat()));
}

/** Remove inline labels that don't correspond to retrieved sources (keeping the valid ones in a group). */
export function stripUnknownLabels(text: string, sources: Map<string, RetrievedChunk>): string {
  return text.replace(LABEL_GROUP, (_m, group: string) => {
    const known = splitGroup(group).filter((l) => sources.has(l));
    return known.length ? `[${known.join(", ")}]` : "";
  });
}

/** Remove every inline label (used when no citation list will be shown). */
export function stripAllLabels(text: string): string {
  return text.replace(LABEL_GROUP, "").replace(/[ \t]+([.,;:])/g, "$1").trim();
}

/**
 * Rewrite inline labels to the 1-based numbers of the citation list the student sees,
 * e.g. "[S3, S1]" → "[2, 1]". Unknown or uncited labels are dropped.
 */
export function renumberLabels(text: string, sources: Map<string, RetrievedChunk>, cited: RetrievedChunk[]): string {
  const order = new Map(cited.map((c, i) => [c.id, i + 1]));
  return text
    .replace(LABEL_GROUP, (_m, group: string) => {
      const nums = Array.from(new Set(splitGroup(group).map((l) => order.get(sources.get(l)?.id ?? "")).filter((n): n is number => !!n)));
      return nums.length ? `[${nums.join(", ")}]` : "";
    })
    .replace(/[ \t]+([.,;:])/g, "$1");
}
