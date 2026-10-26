import { describe, expect, it } from "vitest";
import { extractInlineLabels, labelSources, quoteSupported, renumberLabels, resolveLabels, stripAllLabels, stripUnknownLabels } from "@/lib/core/citations";
import { boundContext, buildTsQuery } from "@/lib/core/query";
import type { RetrievedChunk } from "@/lib/core/types";

const chunk = (id: string, content: string): RetrievedChunk => ({
  id, document_id: "d", document_title: "Notes", content, page: 3, heading: "Paging", similarity: 0.8, score: 0.03,
});

const passage =
  "Paging divides physical memory into fixed-sized blocks called frames and logical memory into blocks of the same size called pages. Paging avoids external fragmentation.";

describe("quoteSupported", () => {
  it("accepts verbatim quotes regardless of case and punctuation", () => {
    expect(quoteSupported("paging avoids external fragmentation", passage)).toBe(true);
    expect(quoteSupported("“Paging divides physical memory into fixed-sized blocks called frames”", passage)).toBe(true);
  });
  it("rejects fabricated or too-short quotes", () => {
    expect(quoteSupported("Paging eliminates internal fragmentation entirely in all cases", passage)).toBe(false);
    expect(quoteSupported("Paging", passage)).toBe(false);
    expect(quoteSupported("", passage)).toBe(false);
  });
});

describe("labels", () => {
  const sources = labelSources([chunk("a", passage), chunk("b", "Other text about TLB hit ratio.")]);
  it("resolves only retrieved labels, dropping unknown and duplicate ones", () => {
    const out = resolveLabels(["S2", "[S1]", "S9", "s2"], sources);
    expect(out.map((c) => c.id)).toEqual(["b", "a"]);
  });
  it("extracts and strips inline labels", () => {
    const text = "Frames are fixed size [S1]. TLB is a cache [S2]. Fake claim [S7].";
    expect(extractInlineLabels(text)).toEqual(["S1", "S2", "S7"]);
    expect(stripUnknownLabels(text, sources)).toBe("Frames are fixed size [S1]. TLB is a cache [S2]. Fake claim .");
  });
});

describe("grouped labels", () => {
  const sources = labelSources([chunk("a", passage), chunk("b", "TLB text"), chunk("c", "LRU text")]);
  it("extracts labels from groups like [S1, S3]", () => {
    expect(extractInlineLabels("FIFO [S1, S3] and TLB [S2].")).toEqual(["S1", "S3", "S2"]);
  });
  it("renumbers groups to the citation list order and drops unknown labels", () => {
    const cited = [sources.get("S3")!, sources.get("S1")!];
    expect(renumberLabels("FIFO [S1, S3, S9] and TLB [S2].", sources, cited)).toBe("FIFO [2, 1] and TLB.");
  });
  it("keeps only valid labels inside a group", () => {
    expect(stripUnknownLabels("x [S1, S9] y [S9]", sources)).toBe("x [S1] y ");
  });
  it("strips every label for insufficient-evidence answers", () => {
    expect(stripAllLabels("Not covered; topics include paging [S1, S2, S3, S4, S5].")).toBe("Not covered; topics include paging.");
  });
});

describe("retrieval helpers", () => {
  it("builds a sanitised OR tsquery without stopwords or operators", () => {
    expect(buildTsQuery("What is Belady's anomaly in FIFO? & | !")).toBe("belady | anomaly | fifo");
    expect(buildTsQuery("the of a")).toBe("");
  });
  it("bounds context size but always keeps the first chunk", () => {
    const big = chunk("x", "y".repeat(9000));
    expect(boundContext([big, chunk("z", "small")], 7000).map((c) => c.id)).toEqual(["x"]);
    expect(boundContext([chunk("a", "aa"), chunk("b", "bb")], 7000)).toHaveLength(2);
  });
});
