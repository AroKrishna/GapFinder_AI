import { RETRIEVAL } from "./config";
import type { RetrievedChunk } from "./types";

const STOP = new Set(
  "a an and are as at be by can does for from how in is it its of on or that the this to was what when where which who why with explain describe define".split(" "),
);

/** Turn free text into a safe OR-tsquery string ("deadlock | prevent | ...") for the keyword half. */
export function buildTsQuery(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
  return Array.from(new Set(words)).slice(0, 12).join(" | ");
}

/** Keep retrieved context bounded so prompts stay small and predictable. */
export function boundContext(chunks: RetrievedChunk[], maxChars = RETRIEVAL.maxContextChars): RetrievedChunk[] {
  const out: RetrievedChunk[] = [];
  let used = 0;
  for (const c of chunks) {
    if (used + c.content.length > maxChars && out.length) break;
    out.push(c);
    used += c.content.length;
  }
  return out;
}
