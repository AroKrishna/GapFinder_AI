# RAG pipeline

```
upload ─► extract ─► chunk + metadata ─► embed ─► index (pgvector + tsvector)
                                                        │
question/topic ─► embed query ─► hybrid search (cosine ∪ full-text, RRF) ─► bound context
                                                        │
                       grounded generation (JSON mode, passages as untrusted data)
                                                        │
                    deterministic validation (labels ⊂ retrieved, quote ∈ passage)
```

## 1. Ingestion (`lib/services/ingest.ts`)
- **Upload:** the browser calls `POST /api/documents`, which validates the type, size and workspace ownership and reserves `<user_id>/<workspace_id>/<uuid>-<name>`. The browser then uploads **directly** to Supabase Storage; the storage policy only allows writes into the caller's own folder. The browser then calls `POST /api/documents/:id/process`.
- **Extract:** PDFs are read with `unpdf`, which works serverless and returns text per page. The magic bytes are checked first. More than 60 pages is rejected, as are corrupt or password-protected files. Near-empty text is treated as a scanned PDF and rejected with a clear message. Text and Markdown are decoded as UTF-8.
- **Chunk** (`lib/core/chunker.ts`): text is normalised, then split into paragraphs while tracking the most recent heading (Markdown `#`, `Unit/Chapter/Section …`, numbered `2.1 Title` or short ALL-CAPS lines). Paragraphs are packed into windows of about 900 characters with about 150 characters of overlap carried from the previous chunk, and oversized paragraphs are split on sentence boundaries. Each chunk stores `page`, `heading` and `idx`. There is a cap of 250 chunks per document.
- **Embed:** `gemini-embedding-001` with `taskType: RETRIEVAL_DOCUMENT` and `outputDimensionality: 768`, in batches of 50. Vectors are L2-normalised, because truncated-dimension outputs aren't unit length. The embedded text includes the heading.
- **Index:** `document_chunks.embedding vector(768)` has an HNSW cosine index, and `fts` is a generated `tsvector` with a GIN index.
- **Failure handling:** any error sets `status = failed` with a readable message and removes partial chunks, so a **Retry** is idempotent. A stale `processing` state older than 2 minutes (for example after a platform timeout) can also be retried.

## 2. Retrieval (`lib/services/retrieval.ts`, SQL `match_chunks`)
- The query is embedded with `RETRIEVAL_QUERY`.
- The keyword query is built deterministically (`lib/core/query.ts`): lowercase, strip punctuation and stopwords, then OR the terms (`belady | anomaly | fifo`). No user text reaches `to_tsquery` unsanitised.
- `match_chunks` takes the top 20 by cosine distance and the top 20 by `ts_rank`, then fuses them with **Reciprocal Rank Fusion** (`1/(60+rank)`) and returns the top *k* (at most 12) with similarity, document title, page and heading.
- The function is `SECURITY INVOKER`, so **RLS restricts results to the caller's own chunks** even if a workspace id from another user is passed (verified in `tests/db`).
- `boundContext()` caps the total context at about 7,000 characters.

Retrieval is a separate module from generation, so it can be tested and explained on its own.

## 3. Grounded generation (`lib/ai/*`)
- Passages are sent as `<passage id="S3" source="Notes · p.4 · Paging">…</passage>`. The system prompt states that passage text is **untrusted data** and must never be followed as instructions.
- Models cite short labels (`S1…Sn`, `C1…Cn`), never raw ids, so they cannot invent a database reference.
- Output is constrained with `responseMimeType: application/json` + `responseJsonSchema`, then parsed with **Zod**. Malformed output is regenerated once, then surfaced as an error.

## 4. Validation (`lib/core/citations.ts`, `lib/core/quizValidate.ts`)
- **Topics:** a topic is kept only if at least one of its passage labels maps to a passage that was actually shown. Duplicates are merged.
- **Questions:** the topic label must be known. The stem needs at least 10 characters and must not duplicate another. There must be exactly 4 non-empty, distinct options and an answer index from 0 to 3. The cited labels must be a subset of **that topic's** retrieved passages. The `evidence_quote` must appear in a cited passage, either as an exact normalised substring or with at least 80% of its 5-word shingles present. Rejected questions are logged and counted, and the count is shown to the student.
- **Tutor:** if the best similarity is below 0.55, the tutor answers "not enough evidence" **without calling the LLM**. Otherwise citations come from the labels the model returned plus any inline `[S#]` markers, filtered to retrieved passages and renumbered `[1]..[n]` to match the source list. An answer with no valid citation is replaced by the insufficient-evidence message rather than shown as grounded.

## 5. Cost and latency bounds
| Operation | Gemini calls |
|---|---|
| Process a document | ⌈chunks / 50⌉ embedding calls |
| Build topic map | 1 generation |
| Generate a quiz (≤ 6 topics) | 1 batched embedding call + 1 generation |
| Tutor question | 1 embedding + ≤ 1 generation |
| Plan / scoring / mastery | 0 (deterministic) |
