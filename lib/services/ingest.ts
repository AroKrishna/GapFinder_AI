import "server-only";
import { AiError, embedTexts } from "@/lib/ai/gemini";
import { chunkPages } from "@/lib/core/chunker";
import { INGEST } from "@/lib/core/config";
import type { PageText } from "@/lib/core/types";
import type { Supabase } from "@/lib/supabase/server";
import { checkMaybe, HttpError, notFound } from "./http";

export class IngestError extends Error {}

export async function extractPages(bytes: Uint8Array, mime: string): Promise<PageText[]> {
  if (mime === "application/pdf") {
    if (bytes.length < 5 || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
      throw new IngestError("This file is not a valid PDF.");
    }
    let pages: string[];
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      if (pdf.numPages > INGEST.maxPages) {
        throw new IngestError(`PDF has ${pdf.numPages} pages; the limit is ${INGEST.maxPages}. Split it into smaller parts.`);
      }
      ({ text: pages } = await extractText(pdf, { mergePages: false }));
    } catch (e) {
      if (e instanceof IngestError) throw e;
      throw new IngestError("Could not read this PDF — it may be corrupted or password-protected.");
    }
    const total = pages.reduce((n, t) => n + t.trim().length, 0);
    if (total < INGEST.minCharsPerPage * Math.max(1, pages.length) * 0.5) {
      throw new IngestError("No readable text found — this looks like a scanned PDF. OCR is not supported yet.");
    }
    return pages.map((text, i) => ({ page: i + 1, text }));
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (text.trim().length < 50) throw new IngestError("The file is empty or too short to analyse.");
  return [{ page: null, text }];
}

/**
 * Bounded, idempotent ingestion: download → extract → chunk → embed → store.
 * Re-running (retry) replaces any previous chunks for the document.
 */
export async function processDocument(supabase: Supabase, documentId: string) {
  const doc = checkMaybe(
    await supabase
      .from("documents")
      .select("id, workspace_id, storage_path, mime, status, updated_at")
      .eq("id", documentId)
      .maybeSingle(),
    "Load document",
  );
  if (!doc) throw notFound("Document");
  // A run that died (e.g. platform timeout) leaves "processing" behind; allow retry after 2 minutes.
  if (doc.status === "processing" && Date.now() - Date.parse(doc.updated_at) < 120_000) {
    throw new HttpError(409, "This document is already being processed.");
  }

  await supabase.from("documents").update({ status: "processing", error: null, updated_at: new Date().toISOString() }).eq("id", doc.id);

  try {
    const { data: blob, error } = await supabase.storage.from("documents").download(doc.storage_path);
    if (error || !blob) throw new IngestError("Uploaded file not found in storage. Please re-upload.");
    if (blob.size > INGEST.maxFileBytes) throw new IngestError("File exceeds the 10 MB limit.");
    const pages = await extractPages(new Uint8Array(await blob.arrayBuffer()), doc.mime);
    const chunks = chunkPages(pages);
    if (!chunks.length) throw new IngestError("No usable text passages were found in this document.");

    const vectors = await embedTexts(
      chunks.map((c) => (c.heading ? `${c.heading}\n${c.content}` : c.content)),
      "RETRIEVAL_DOCUMENT",
    );

    checkMaybe(await supabase.from("document_chunks").delete().eq("document_id", doc.id), "Clear chunks");
    const rows = chunks.map((c, i) => ({
      workspace_id: doc.workspace_id,
      document_id: doc.id,
      idx: c.idx,
      content: c.content,
      page: c.page,
      heading: c.heading,
      embedding: JSON.stringify(vectors[i]),
    }));
    for (let i = 0; i < rows.length; i += 100) {
      checkMaybe(await supabase.from("document_chunks").insert(rows.slice(i, i + 100)), "Store chunks");
    }
    await supabase
      .from("documents")
      .update({
        status: "ready",
        page_count: pages[0]?.page === null ? null : pages.length,
        chunk_count: chunks.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);
    return { status: "ready" as const, chunk_count: chunks.length };
  } catch (e) {
    const message =
      e instanceof IngestError || e instanceof HttpError || e instanceof AiError
        ? (e as Error).message
        : "Processing failed unexpectedly. Please retry.";
    if (!(e instanceof IngestError)) console.error("[ingest]", e);
    await supabase.from("document_chunks").delete().eq("document_id", doc.id);
    await supabase
      .from("documents")
      .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
      .eq("id", doc.id);
    return { status: "failed" as const, error: message, chunk_count: 0 };
  }
}
