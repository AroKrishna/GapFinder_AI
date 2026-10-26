import { describe, expect, it } from "vitest";
import { chunkPages, isHeading } from "@/lib/core/chunker";
import { SAMPLE_DOCUMENTS } from "@/lib/sample/content";

const para = (n: number, word = "scheduling") => Array.from({ length: n }, (_, i) => `${word} sentence number ${i} explains a concept.`).join(" ");

describe("isHeading", () => {
  it("recognises markdown, unit and numbered headings", () => {
    expect(isHeading("## Round Robin (RR)")).toBe(true);
    expect(isHeading("UNIT 3 PROCESS SYNCHRONIZATION")).toBe(true);
    expect(isHeading("2.1 Paging Basics")).toBe(true);
    expect(isHeading("EXAMINATION PATTERN")).toBe(true);
  });
  it("rejects normal sentences", () => {
    expect(isHeading("A process is a program in execution.")).toBe(false);
    expect(isHeading("This is a short line")).toBe(false);
  });
});

describe("chunkPages", () => {
  it("preserves page numbers and nearest heading", () => {
    const chunks = chunkPages([
      { page: 1, text: `# Deadlocks\n\n${para(5, "deadlock")}` },
      { page: 2, text: `# Paging\n\n${para(5, "paging")}` },
    ], { chunkChars: 400, overlapChars: 80 });
    expect(chunks.length).toBeGreaterThan(1);
    const pagingChunk = chunks.find((c) => c.content.includes("paging sentence"))!;
    expect(pagingChunk.page).toBe(2);
    expect(pagingChunk.heading).toBe("Paging");
    expect(chunks[0].heading).toBe("Deadlocks");
    expect(chunks[0].page).toBe(1);
    chunks.forEach((c, i) => expect(c.idx).toBe(i));
  });

  it("respects the size bound and carries overlap between consecutive chunks", () => {
    const chunks = chunkPages([{ page: null, text: `# Topic\n\n${para(20)}\n\n${para(20)}` }], { chunkChars: 500, overlapChars: 120 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(500 + 130);
    // The start of chunk 2 should repeat text from the end of chunk 1.
    const tail = chunks[0].content.slice(-60).split(" ").slice(1, 5).join(" ");
    expect(chunks[1].content).toContain(tail);
  });

  it("starts a new chunk at every page and section boundary, even for short pages", () => {
    const chunks = chunkPages([
      { page: 1, text: "UNIT 1 NORMALIZATION\nA relation is in first normal form when every attribute is atomic." },
      { page: 2, text: "UNIT 2 TRANSACTIONS\nAtomicity means a transaction completes entirely or not at all." },
    ]);
    expect(chunks.map((c) => [c.page, c.heading])).toEqual([[1, "UNIT 1 NORMALIZATION"], [2, "UNIT 2 TRANSACTIONS"]]);
  });

  it("enforces the max chunk cap", () => {
    const chunks = chunkPages([{ page: 1, text: para(400) }], { chunkChars: 300, overlapChars: 50, maxChunks: 5 });
    expect(chunks).toHaveLength(5);
  });

  it("returns no chunks for empty input", () => {
    expect(chunkPages([{ page: 1, text: "   \n\n  " }])).toEqual([]);
  });

  it("chunks the bundled sample material with headings", () => {
    const doc = SAMPLE_DOCUMENTS[1];
    const chunks = chunkPages([{ page: null, text: doc.content }]);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.some((c) => c.heading === "Round Robin (RR)")).toBe(true);
  });
});
