import { INGEST } from "./config";
import type { Chunk, PageText } from "./types";

const HEADING_RE = /^(#{1,6}\s+.+|(?:unit|chapter|module|section)\s+[\w.]+.*|\d+(?:\.\d+)*\s+[A-Z].{2,80}|[A-Z][A-Z0-9 ,:&()\-]{3,80})$/i;

/** A line looks like a heading: markdown "#", "Unit 3 …", "2.1 Title", or SHORT ALL CAPS. */
export function isHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 90) return false;
  if (/[.;,]$/.test(t)) return false;
  if (t.startsWith("#")) return true;
  if (/^(unit|chapter|module|section)\s+[\w.]+/i.test(t)) return true;
  if (/^\d+(\.\d+)*\s+[A-Z]/.test(t)) return true;
  return HEADING_RE.test(t) && t === t.toUpperCase() && /[A-Z]/.test(t);
}

function cleanHeading(line: string): string {
  return line.replace(/^#+\s*/, "").trim().slice(0, 120);
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface Para {
  text: string;
  page: number | null;
  heading: string | null;
  overlap?: boolean;
}

/**
 * Split pages into paragraphs, tracking the nearest preceding heading, then pack
 * paragraphs into ~chunkChars windows with overlapChars of trailing context carried
 * forward. Page and heading metadata come from the first paragraph in each chunk.
 */
export function chunkPages(
  pages: PageText[],
  opts: { chunkChars?: number; overlapChars?: number; maxChunks?: number } = {},
): Chunk[] {
  const size = opts.chunkChars ?? INGEST.chunkChars;
  const overlap = opts.overlapChars ?? INGEST.overlapChars;
  const maxChunks = opts.maxChunks ?? INGEST.maxChunksPerDoc;

  const paras: Para[] = [];
  let heading: string | null = null;
  for (const p of pages) {
    const blocks = normalizeText(p.text).split(/\n\s*\n/);
    for (const block of blocks) {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      let buf: string[] = [];
      const flush = () => {
        if (buf.length) paras.push({ text: buf.join(" "), page: p.page, heading });
        buf = [];
      };
      for (const line of lines) {
        if (isHeading(line)) {
          flush();
          heading = cleanHeading(line);
          // keep the heading text itself searchable inside the following chunk
          buf.push(cleanHeading(line) + ":");
        } else {
          buf.push(line);
        }
      }
      flush();
    }
  }

  // Split any oversized paragraph on sentence boundaries.
  const pieces: Para[] = [];
  for (const para of paras) {
    if (para.text.length <= size) {
      pieces.push(para);
      continue;
    }
    const sentences = para.text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [para.text];
    let cur = "";
    for (const s of sentences) {
      if (cur && cur.length + s.length > size) {
        pieces.push({ ...para, text: cur.trim() });
        cur = "";
      }
      if (s.length > size) {
        for (let i = 0; i < s.length; i += size) pieces.push({ ...para, text: s.slice(i, i + size).trim() });
      } else cur += s;
    }
    if (cur.trim()) pieces.push({ ...para, text: cur.trim() });
  }

  const chunks: Chunk[] = [];
  let cur: Para[] = [];
  let curLen = 0;
  const emit = () => {
    if (!cur.length) return;
    const content = cur.map((p) => p.text).join("\n").trim();
    // Skip chunks that are only a heading with no body text.
    // Metadata comes from the first new (non-overlap) piece.
    const meta = cur.find((p) => !p.overlap) ?? cur[0];
    if (content.replace(/[^a-z0-9]/gi, "").length >= 20 && cur.some((p) => !p.overlap)) {
      chunks.push({ idx: chunks.length, content, page: meta.page, heading: meta.heading });
    }
  };
  for (const piece of pieces) {
    // Never let a chunk span a page or section boundary, so its page/heading citation is exact.
    const last = cur[cur.length - 1];
    if (last && (piece.page !== last.page || piece.heading !== last.heading)) {
      emit();
      if (chunks.length >= maxChunks) return chunks;
      cur = [];
      curLen = 0;
    }
    if (curLen > 0 && curLen + piece.text.length > size) {
      emit();
      if (chunks.length >= maxChunks) return chunks;
      // Carry overlap: trailing text from the previous chunk, same page/heading as its last piece.
      const last = cur[cur.length - 1];
      const tail = last.text.length > overlap ? last.text.slice(-overlap).replace(/^\S*\s/, "") : last.text;
      cur = tail && piece.heading === last.heading ? [{ ...last, text: tail, overlap: true }] : [];
      curLen = cur.reduce((n, p) => n + p.text.length, 0);
    }
    cur.push(piece);
    curLen += piece.text.length;
  }
  emit();
  return chunks.slice(0, maxChunks);
}
