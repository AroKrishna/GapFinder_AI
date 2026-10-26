# GapFinder AI

**Find your gaps. Focus your learning. Improve with evidence.**

GapFinder AI is a personalised learning and knowledge-gap diagnosis platform, built for the Sphoorthy Engineering College Hackathon 2026. Students upload their own syllabus, notes or past papers. The app builds a source-linked topic map from them and generates diagnostic quizzes **grounded in retrieved passages**. It then scores answers deterministically, estimates topic-level mastery with evidence, and produces an **adaptive revision plan** that fits the exam date and daily study hours.

> The app is a diagnosis tool, not a chatbot. AI is used for document understanding, grounded question generation and explanations. Scoring, mastery, prioritisation and scheduling are transparent, tested, deterministic code.

- **Judges:** see [docs/JUDGES.md](docs/JUDGES.md) for a 5-minute walkthrough.
- **Architecture:** see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **RAG pipeline:** see [docs/RAG.md](docs/RAG.md).

## Features

| Area | What it does |
|---|---|
| Auth & workspaces | Supabase email/password auth, cookie sessions, protected pages, one workspace per subject (exam date, hours/day) |
| Documents | PDF / .txt / .md upload **directly to private Supabase Storage**; extraction → overlapping chunks with page + heading metadata → Gemini embeddings → pgvector. Status, errors, retry, safe delete |
| Topic map | Topics/subtopics extracted by Gemini from indexed passages. A topic is kept **only if it cites real passages** |
| Hybrid RAG | pgvector cosine search + Postgres full-text search, fused with Reciprocal Rank Fusion, scoped to the user via RLS |
| Diagnostic quiz | 4-option MCQs generated **only from retrieved passages**, each with a verbatim evidence quote that is checked against the cited passage. Invalid questions are rejected and counted |
| Evaluation | Answer-key scoring, enforced by a database trigger. Idempotent submit. Results show the selected and correct answer, an explanation and citations |
| Gap report | Weak / developing / strong / **not assessed**, with score, question count, provisional flag, reasons, mistakes, successes and next actions |
| Revision plan | Deterministic priority (importance × gap severity, plus a decline bonus), packed into your daily hours until the exam. Versioned, keeps completed tasks, and **explains what changed** |
| AI tutor | Fresh retrieval on every question, bounded history, numbered citations, and an explicit *"not enough evidence"* answer when the material is insufficient |
| Dashboard | What am I struggling with? What next? Am I improving? Mastery chart, score trend, plan completion, activity |
| Sample workspace | Clearly labelled Operating Systems material that runs through the **live** pipeline. Nothing is pre-scored |

## Tech stack

Next.js 16 (App Router, TypeScript strict) · Tailwind CSS 4 with shadcn-style components · Supabase (Postgres, Auth, Storage, pgvector) · Google Gemini via `@google/genai` (`gemini-flash-latest` for generation, `gemini-embedding-001` @ 768-d for embeddings) · `unpdf` · Zod · Recharts · Vitest · PGlite (DB tests).

## Local setup

### 1. Prerequisites
- Node.js 20+ and npm
- A Supabase project (the free tier works)
- A Google AI Studio API key (Gemini)

### 2. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It enables `vector` and creates every table, index, RLS policy, the `match_chunks` RPC, the scoring trigger, and the private `documents` storage bucket with per-user folder policies. It is safe to re-run.
3. **Authentication → Sign In / Providers → Email**: for a smooth demo, turn **off** "Confirm email". If you leave it on, the app handles confirmation through `/auth/callback`.
4. **Authentication → URL Configuration**: set the Site URL to your deployment URL and add `http://localhost:3000/**` and `https://<your-app>.vercel.app/**` to the Redirect URLs.
5. **Project Settings → API**: copy the Project URL, the anon (publishable) key and the service-role (secret) key.

### 3. Environment variables
```bash
cp .env.example .env.local
```
| Variable | Where it's used | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server (RLS-limited) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | **Only** `scripts/create-demo-user.mjs` (run locally). Never used by request handlers | For the demo script |
| `GEMINI_API_KEY` | Server only | Yes |
| `GEMINI_MODEL` | Server, default `gemini-flash-latest` | No |
| `GEMINI_FALLBACK_MODELS` | Server, comma-separated, default `gemini-flash-lite-latest` | No |
| `GEMINI_EMBED_MODEL` | Server, default `gemini-embedding-001` (768-d output; must match `vector(768)`) | No |

### 4. Run
```bash
npm install
npm run dev        # http://localhost:3000
```

### 5. Demo Admin Account

A dedicated demo account is pre-configured with admin-style access for evaluators to test the full product without waiting for document processing:

- **Email:** `admin@gapfinder.demo`
- **Password:** `GapFinder-Admin-2026!`
- **Workspace:** `Operating Systems — End Semester Prep` (3 documents indexed, 21 chunks with 768-d vector embeddings, 7 topics, active revision plan, ready diagnostic quiz)

To safely provision or refresh this account at any time:
```bash
npm run provision:demo
```
This administrative script is idempotent: it ensures the user exists, confirms their email, verifies their profile, provisions the demo workspace, chunks & embeds the sample notes with Gemini, links topic citations, schedules revision tasks, and seeds a ready diagnostic quiz.

## Testing

| Command | What it checks | Needs credentials? |
|---|---|---|
| `npm test` | 55 Vitest unit tests: security validation, path traversal defense, prompt injection tag escaping, chunking, citations, quiz validation, server-side scoring, mastery thresholds, planner budget | No |
| `npm run test:db` | Applies the real migration to PGlite (Postgres + pgvector) with stubbed Supabase `auth` and `storage`. Verifies cross-user **RLS isolation** across all tables, storage policies, scoring trigger, and cascade deletes | No |
| `npm run typecheck` | `next typegen` plus `tsc --noEmit` (strict) | No |
| `npm run lint` | ESLint (Next config, 0 warnings) | No |
| `npm run build` | Next.js Turbopack production build (all 13 static & dynamic routes) | No |
| `npm run test:demo-journey` | **End-to-end evaluator walkthrough**: authenticates as demo user, verifies workspace, materials, embeddings, topic citations, task persistence, quiz readiness, semantic in-scope retrieval, and out-of-scope refusal | Yes (`.env.local`) |
| `npm run verify:setup` | Live Supabase verification: tables, `match_chunks` + `vector(768)`, private bucket, anonymous read/write/upload blocked | Yes (`.env.local`) |
| `npm run test:e2e -- http://localhost:3000` | Full HTTP API E2E test against running server: creates throwaway users, tests complete pipeline and cleans up | Yes (Supabase + Gemini, server running) |

Browser-only behaviour (clicking through the UI, drag-and-drop upload, visual layout) is covered by the manual checklist in [docs/JUDGES.md](docs/JUDGES.md#manual-end-to-end-test).

### Gemini availability
Generation uses `GEMINI_MODEL` and automatically falls back to `GEMINI_FALLBACK_MODELS` (default `gemini-flash-lite-latest`) on overload (503/504), rate limiting (429), retirement (404) or timeout. Each call has a 25 s timeout inside a 48 s budget, so routes stay within Vercel's 60 s limit. The SDK's own retries (5 attempts by default) are disabled.

## Project structure
```
app/                      Pages (App Router) and route handlers (app/api/**)
  (auth)/                 login, signup
  (app)/workspaces        workspace list, onboarding, sample workspace
  (app)/w/[wid]/          dashboard, documents, topics, quizzes, quiz/[qid], gaps, plan, tutor, settings
lib/core/                 Pure, unit-tested logic: chunker, citations, quizValidate, scoring, mastery, planner, config
lib/ai/                   Gemini adapter (retry, JSON mode + Zod), prompts, output schemas
lib/services/             Server services: ingest, retrieval, topics, quiz, plan, tutor, rate limit, auth guards
lib/sample/               Sample study material (labelled SAMPLE)
supabase/migrations/      Schema, RLS, RPC, triggers, storage policies
tests/unit, tests/db      Vitest unit tests; PGlite database/RLS test
proxy.ts                  Session refresh + optimistic redirect (Next 16 "proxy", formerly middleware)
```

## Security
- **Data isolation:** every table has `user_id` and RLS (`user_id = auth.uid()`). Writes must also target a workspace the caller owns. Route handlers additionally check ownership before any AI call. Storage objects live under `<user_id>/…` with matching policies. The retrieval RPC is `SECURITY INVOKER`, so RLS applies to search. All of this is verified by `npm run test:db`.
- **Secrets:** the Gemini key is used only in `server-only` modules. The service-role key is never used by the running app.
- **Validation:** Zod validates every request body and every AI output. Files are checked for type, size (10 MB), PDF magic bytes, page count and readable text.
- **Prompt injection:** documents are wrapped in `<passage>` tags and treated as data. AI outputs are accepted only if they cite retrieved passages, and quiz evidence quotes must appear in the cited passage.
- **Scoring integrity:** correctness is computed by a database trigger from the stored key. Responses are insert-only and unique per question. Answer keys are not sent to the quiz page.
- **Abuse controls:** a per-user hourly limit on AI endpoints, stored in Postgres (quiz 12/h, tutor 40/h, processing 30/h, topic map 10/h, sample 5/h).

## Known limitations
- No OCR: scanned or image-only PDFs are detected and rejected with a clear message.
- Only multiple-choice questions; there's no short-answer rubric grading yet.
- Rate limiting is best-effort (count-then-insert), not strictly atomic under heavy concurrency.
- A user can technically read their own answer keys through the Supabase API (RLS is per-user). It's acceptable for self-assessment, but answer keys are never shown in the app before submission.
- Processing runs inside the request (bounded to 60 s). Very large documents should be split.
- Topic extraction samples up to 40 passages per run, so very large libraries may need a rebuild after adding material.

## Future improvements
OCR for scanned PDFs (e.g. Gemini document understanding), a cross-encoder reranker, short-answer rubric grading, spaced-repetition scheduling, durable background jobs for large uploads, streaming tutor responses, and a Playwright E2E suite running against a seeded Supabase branch.
