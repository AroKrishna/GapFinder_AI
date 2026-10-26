"use client";

import { Check, ExternalLink, FileText, FileUp, Info, Loader2, RotateCw, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SampleBadge, StatusPill, type DocStatus } from "@/components/badges";
import { BuildTopicsButton } from "@/components/topic-actions";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { api } from "@/lib/api-client";
import { INGEST } from "@/lib/core/config";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate } from "@/lib/utils";

export interface DocRow {
  id: string;
  title: string;
  storage_path: string;
  mime: string;
  size_bytes: number;
  status: DocStatus;
  error: string | null;
  page_count: number | null;
  chunk_count: number;
  is_sample: boolean;
  created_at: string;
}

type Stage = "uploading" | "reading";

function mimeFor(file: File): string | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".md") || file.type === "text/markdown") return "text/markdown";
  if (file.type === "text/plain" || name.endsWith(".txt")) return "text/plain";
  return null;
}

/** Plain-language advice for a failed document, based on the server's reason. */
function adviceFor(error: string | null): string {
  const e = (error ?? "").toLowerCase();
  if (e.includes("scanned")) return "This looks like a scanned or photographed PDF. Export a text-based PDF, or copy the notes into a .txt file and upload that.";
  if (e.includes("pages")) return "Split the file into smaller parts (for example, one unit per file) and upload them separately.";
  if (e.includes("not a valid pdf") || e.includes("corrupt") || e.includes("password")) return "Open the file on your computer to check it isn't damaged or password-protected, then upload it again.";
  if (e.includes("empty") || e.includes("short")) return "The file has almost no text. Check you picked the right file.";
  if (e.includes("ai provider") || e.includes("busy") || e.includes("rate")) return "Our AI service was busy. Wait a minute and press Retry.";
  return "Press Retry. If it keeps failing, remove the file and upload it again.";
}

function kindLabel(mime: string) {
  return mime === "application/pdf" ? "PDF" : mime === "text/markdown" ? "Markdown Notes" : "Plain Text";
}

export function DocumentManager({ workspaceId, initialDocs, hasTopics }: { workspaceId: string; initialDocs: DocRow[]; hasTopics: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<{ name: string; stage: Stage } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const docs = initialDocs;
  const anyProcessing = docs.some((d) => d.status === "processing");
  const readyCount = docs.filter((d) => d.status === "ready").length;

  useEffect(() => {
    if (!anyProcessing) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [anyProcessing, router]);

  async function startUpload(file: File) {
    const mime = mimeFor(file);
    if (!mime) return toast.error("Please choose a PDF, .txt or .md file.");
    if (file.size > INGEST.maxFileBytes) return toast.error("That file is over 10 MB. Try splitting it into smaller parts.");
    if (file.size === 0) return toast.error("That file is empty.");

    setUpload({ name: file.name, stage: "uploading" });
    let docId: string | null = null;
    try {
      const reserved = await api<{ document_id: string; storage_path: string }>("/api/documents", {
        body: { workspace_id: workspaceId, title: file.name.replace(/\.[^.]+$/, ""), filename: file.name, mime, size: file.size },
      });
      docId = reserved.document_id;
      const { error } = await createClient().storage.from("documents").upload(reserved.storage_path, file, { contentType: mime });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      setUpload({ name: file.name, stage: "reading" });
      const res = await api<{ status: string; error?: string; chunk_count: number }>(`/api/documents/${docId}/process`);
      if (res.status === "ready") toast.success(`${file.name} is ready`);
      else toast.error(`${file.name} needs attention: ${res.error ?? "processing failed"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      if (docId) await api(`/api/documents/${docId}`, { method: "DELETE" }).catch(() => {});
    } finally {
      setUpload(null);
      router.refresh();
    }
  }

  async function retry(id: string) {
    setBusyId(id);
    try {
      const res = await api<{ status: string; error?: string }>(`/api/documents/${id}/process`);
      if (res.status === "ready") toast.success("Ready");
      else toast.error(res.error ?? "Processing failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setBusyId(null);
      router.refresh();
    }
  }

  async function remove(d: DocRow) {
    if (!confirm(`Remove "${d.title}"? It will no longer be used for quizzes or tutor answers, and topics that came only from it are removed too.`)) return;
    setBusyId(d.id);
    try {
      await api(`/api/documents/${d.id}`, { method: "DELETE" });
      toast.success("Material removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove it");
    } finally {
      setBusyId(null);
      router.refresh();
    }
  }

  async function open(d: DocRow) {
    const win = window.open("", "_blank");
    const { data, error } = await createClient().storage.from("documents").createSignedUrl(d.storage_path, 120);
    if (error || !data) {
      win?.close();
      toast.error("Couldn't open this file");
      return;
    }
    if (win) win.location.href = data.signedUrl;
    else window.location.assign(data.signedUrl);
  }

  const pickFile = () => inputRef.current?.click();

  return (
    <div className="space-y-6">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void startUpload(f);
        }}
      />

      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !upload) void startUpload(f);
        }}
        className={cn(
          "flex flex-col items-center gap-4 rounded-[var(--radius-card)] border-2 border-dashed px-6 text-center transition-colors sm:flex-row sm:text-left",
          docs.length ? "py-5" : "py-10 sm:flex-col sm:text-center",
          dragOver ? "border-brand bg-brand-soft" : "border-border-strong bg-surface",
        )}
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <FileUp className="size-5" aria-hidden />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-ink">Upload your study materials</p>
          <p className="mt-0.5 text-xs text-muted">
            PDF, .txt or .md · up to 10 MB and {INGEST.maxPages} pages · text-based materials only
          </p>
        </div>
        <Button onClick={pickFile} disabled={!!upload}>
          <Upload className="size-4" /> Upload materials
        </Button>
      </div>

      {/* In-flight upload: real stages only */}
      {upload && (
        <Card className="p-4" aria-live="polite">
          <div className="flex items-center gap-3">
            <Loader2 className="size-4 animate-spin text-brand" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{upload.name}</span>
          </div>
          <ol className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <li className={cn("inline-flex items-center gap-1.5", upload.stage === "uploading" ? "font-semibold text-brand" : "text-[#16845B]")}>
              {upload.stage === "uploading" ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Uploading file to storage
            </li>
            <li className={cn("inline-flex items-center gap-1.5", upload.stage === "reading" ? "font-semibold text-brand" : "text-faint")}>
              {upload.stage === "reading" ? <Loader2 className="size-3 animate-spin" /> : <span className="size-2 rounded-full border border-border-strong" />} Extracting sections &amp; indexing
            </li>
          </ol>
        </Card>
      )}

      {/* Next step prompt */}
      {readyCount > 0 && !hasTopics && (
        <div className="rounded-[var(--radius-card)] border border-brand-border bg-brand-soft p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink">Next step: Discover topics in your material</h2>
              <p className="mt-1 text-xs text-muted">We will extract the topics your material covers and map each topic to its source pages.</p>
            </div>
            <BuildTopicsButton workspaceId={workspaceId} />
          </div>
        </div>
      )}

      {/* Document Library List */}
      <section aria-labelledby="materials-h">
        <SectionTitle
          id="materials-h"
          title="Document Library"
          count={docs.length}
          action={hasTopics && readyCount > 0 && (
            <span className="flex items-center gap-2 text-xs text-muted">
              Added new notes? <BuildTopicsButton workspaceId={workspaceId} rebuild variant="secondary" size="sm" />
            </span>
          )}
        />
        {docs.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="No materials uploaded yet"
            description="Upload your lecture notes, course outline, textbook chapter, or past papers above to build your study assessment."
          />
        ) : (
          <Card className="divide-y divide-border">
            {docs.map((d) => (
              <div key={d.id} className="p-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted">
                      <FileText className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{d.title.replace(/^SAMPLE — /, "")}</span>
                        {d.is_sample && <SampleBadge />}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {kindLabel(d.mime)}
                        {d.page_count ? ` · ${d.page_count} page${d.page_count === 1 ? "" : "s"}` : ""}
                        {d.status === "ready" ? ` · ${d.chunk_count} sections indexed` : ""}
                        {` · ${Math.max(1, Math.round(d.size_bytes / 1024))} KB · added ${formatDate(d.created_at)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-[48px] sm:pl-0">
                    <StatusPill status={d.status} />
                    <div className="ml-auto flex items-center gap-1 sm:ml-2">
                      {(d.status === "failed" || d.status === "pending") && (
                        <Button size="sm" variant="secondary" onClick={() => retry(d.id)} disabled={busyId === d.id}>
                          {busyId === d.id ? <Loader2 className="size-3 animate-spin" /> : <RotateCw className="size-3" />} Retry
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" aria-label={`Open ${d.title}`} title="Open in new tab" onClick={() => open(d)}>
                        <ExternalLink className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={`Remove ${d.title}`} title="Remove" onClick={() => remove(d)} disabled={busyId === d.id || d.status === "processing"}>
                        <Trash2 className="size-4 text-faint hover:text-[#C34848]" />
                      </Button>
                    </div>
                  </div>
                </div>
                {d.status === "processing" && (
                  <p className="mt-2.5 rounded-md bg-brand-soft px-3 py-1.5 text-xs text-brand-strong sm:ml-[48px]">
                    Indexing document chunks for quiz generation and tutoring search.
                  </p>
                )}
                {d.status === "failed" && (
                  <div className="mt-2.5 flex gap-2 rounded-md border border-[#FCDADA] bg-[#FFF0F0] px-3 py-2 text-xs text-[#C34848] sm:ml-[48px]">
                    <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <div>
                      <p className="font-semibold">{d.error ?? "We couldn't read this file."}</p>
                      <p className="mt-0.5 text-muted">{adviceFor(d.error)}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </Card>
        )}
      </section>

      {hasTopics && (
        <p className="text-center text-xs text-muted">
          Your topics are extracted and ready.{" "}
          <Link href={`/w/${workspaceId}/gaps`} className="font-medium text-brand hover:text-brand-hover">
            Inspect topic gaps report →
          </Link>
        </p>
      )}
    </div>
  );
}
