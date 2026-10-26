// Validates supabase/migrations/0001_init.sql on PGlite (+pgvector) with stubbed Supabase auth/storage schemas.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";

const migrationPath = process.argv[2] ?? new URL("../../supabase/migrations/0001_init.sql", import.meta.url);
const db = await PGlite.create({ extensions: { vector } });

await db.exec(`
  create role authenticated nologin;
  create schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
`);

// pgcrypto isn't bundled in PGlite; gen_random_uuid() is core in PG13+, and Supabase ships pgcrypto anyway.
const sql = readFileSync(migrationPath, "utf8").replace(/create extension if not exists pgcrypto;/, "");
await db.exec(sql);
await db.exec(sql); // idempotency: re-running must not fail
console.log("✓ migration applied twice (idempotent)");

await db.exec(`
  grant usage on schema public, extensions, auth, storage to authenticated;
  grant all on all tables in schema public to authenticated;
  grant all on all sequences in schema public to authenticated;
  grant all on storage.objects to authenticated;
  grant execute on all functions in schema public, auth, storage, extensions to authenticated;
`);

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${A}', 'a@x.edu', '{"display_name":"Asha"}'), ('${B}', 'b@x.edu', '{}');`);
const prof = await db.query("select display_name from profiles order by display_name");
console.log("✓ profile trigger:", prof.rows.map((r) => r.display_name).join(", "));

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) failures++; };
const as = async (uid) => { await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`); };
const expectError = async (fn, msg) => { try { await fn(); ok(false, msg + " (no error raised)"); } catch (e) { ok(true, `${msg} → ${e.message.split("\n")[0]}`); } };
const vec = (seed) => "[" + Array.from({ length: 768 }, (_, i) => Math.sin(seed * 31 + i)).map((x) => x.toFixed(5)).join(",") + "]";

// --- User A builds a workspace end to end
await as(A);
const ws = (await db.query(`insert into workspaces (name, hours_per_day) values ('OS', 2) returning id, user_id`)).rows[0];
ok(ws.user_id === A, "workspace user_id defaults to auth.uid()");
const doc = (await db.query(`insert into documents (workspace_id, title, storage_path, mime) values ($1, 'Notes', '${A}/x/notes.md', 'text/markdown') returning id`, [ws.id])).rows[0];
const contents = [
  "Deadlock requires mutual exclusion, hold and wait, no preemption and circular wait.",
  "Round Robin gives each process a time quantum; a large quantum behaves like FCFS.",
  "FIFO page replacement suffers from Belady's anomaly while LRU does not.",
];
const chunkIds = [];
for (let i = 0; i < contents.length; i++) {
  const r = await db.query(
    `insert into document_chunks (workspace_id, document_id, idx, content, page, heading, embedding) values ($1, $2, $3, $4, 1, 'H', $5) returning id`,
    [ws.id, doc.id, i, contents[i], vec(i)],
  );
  chunkIds.push(r.rows[0].id);
}
const fts = await db.query(`select count(*)::int n from document_chunks where fts @@ to_tsquery('english', 'deadlock')`);
ok(fts.rows[0].n === 1, "generated tsvector column supports keyword search");

const m = await db.query(`select id, content, similarity, score from match_chunks($1, $2::extensions.vector, 'belady | anomaly', 3)`, [ws.id, vec(2)]);
ok(m.rows.length === 3 && m.rows[0].id === chunkIds[2], `match_chunks hybrid RRF ranks the matching chunk first (sim=${Number(m.rows[0].similarity).toFixed(3)})`);
const mEmpty = await db.query(`select count(*)::int n from match_chunks($1, $2::extensions.vector, '', 3)`, [ws.id, vec(1)]);
ok(mEmpty.rows[0].n === 3, "match_chunks works with an empty keyword query (vector only)");

const topic = (await db.query(`insert into topics (workspace_id, name, importance) values ($1, 'Deadlocks', 3) returning id`, [ws.id])).rows[0];
await db.query(`insert into topic_chunks (topic_id, chunk_id) values ($1, $2)`, [topic.id, chunkIds[0]]);
const upsert = await db.query(`insert into topics (workspace_id, name, summary) values ($1, 'Deadlocks', 'updated') on conflict (workspace_id, name) do update set summary = excluded.summary returning id`, [ws.id]);
ok(upsert.rows[0].id === topic.id, "topic upsert by (workspace_id, name) keeps the same id");

const quiz = (await db.query(`insert into quizzes (workspace_id, question_count) values ($1, 1) returning id`, [ws.id])).rows[0];
const q = (await db.query(
  `insert into quiz_questions (quiz_id, topic_id, position, stem, options, correct_index, explanation, source_chunk_ids)
   values ($1, $2, 0, 'Which is not a deadlock condition?', '["Mutual exclusion","Hold and wait","Preemption","Circular wait"]', 2, 'x', $3) returning id`,
  [quiz.id, topic.id, [chunkIds[0]]],
)).rows[0];
await expectError(() => db.query(`insert into quiz_questions (quiz_id, position, stem, options, correct_index, explanation) values ($1, 1, 's', '["a","b"]', 0, 'x')`, [quiz.id]), "options must have exactly 4 entries");

const resp = (await db.query(`insert into quiz_responses (quiz_id, question_id, selected_index, is_correct) values ($1, $2, 1, true) returning is_correct`, [quiz.id, q.id])).rows[0];
ok(resp.is_correct === false, "trigger overrides client-supplied is_correct (wrong answer stays wrong)");
await expectError(() => db.query(`insert into quiz_responses (quiz_id, question_id, selected_index) values ($1, $2, 2)`, [quiz.id, q.id]), "second response to same question rejected (idempotent submit)");
const upd = await db.query(`update quiz_responses set selected_index = 2 where question_id = $1`, [q.id]);
ok(upd.affectedRows === 0, "responses cannot be edited after submission");

const flip1 = await db.query(`update quizzes set status = 'submitted' where id = $1 and status = 'ready' returning id`, [quiz.id]);
const flip2 = await db.query(`update quizzes set status = 'submitted' where id = $1 and status = 'ready' returning id`, [quiz.id]);
ok(flip1.rows.length === 1 && flip2.rows.length === 0, "conditional status flip happens exactly once");

await db.query(`insert into topic_mastery (topic_id, workspace_id, score, n_questions, state) values ($1, $2, 0.33, 1, 'not_assessed')`, [topic.id, ws.id]);
const plan = (await db.query(`insert into revision_plans (workspace_id, version, budget_minutes) values ($1, 1, 120) returning id`, [ws.id])).rows[0];
await db.query(`insert into revision_tasks (workspace_id, plan_id, topic_id, topic_name, activity, priority, minutes, reason, due_date) values ($1, $2, $3, 'Deadlocks', 'read', 7.5, 30, 'weak', current_date)`, [ws.id, plan.id, topic.id]);
await db.query(`insert into ai_usage (endpoint) values ('quiz')`);
await db.query(`insert into storage.objects (bucket_id, name) values ('documents', '${A}/${ws.id}/notes.md')`);
ok(true, "user A can write plans, tasks, usage rows and own storage objects");

// --- User B must see and touch nothing of A's
await as(B);
for (const t of ["workspaces", "documents", "document_chunks", "topics", "topic_chunks", "quizzes", "quiz_questions", "quiz_responses", "topic_mastery", "revision_plans", "revision_tasks", "ai_usage", "profiles"]) {
  const r = await db.query(`select count(*)::int n from ${t}`);
  const expected = t === "profiles" ? 1 : 0;
  ok(r.rows[0].n === expected, `B sees ${r.rows[0].n} rows in ${t}`);
}
const mB = await db.query(`select count(*)::int n from match_chunks($1, $2::extensions.vector, 'deadlock', 6)`, [ws.id, vec(0)]);
ok(mB.rows[0].n === 0, "match_chunks returns nothing for another user's workspace");
await expectError(() => db.query(`insert into documents (workspace_id, title, storage_path, mime, user_id) values ($1, 'evil', 'x', 'text/plain', '${B}')`, [ws.id]), "B cannot insert into A's workspace");
await expectError(() => db.query(`insert into documents (workspace_id, title, storage_path, mime, user_id) values ($1, 'evil', 'x', 'text/plain', '${A}')`, [ws.id]), "B cannot impersonate A via user_id");
const del = await db.query(`delete from workspaces where id = $1`, [ws.id]);
ok(del.affectedRows === 0, "B cannot delete A's workspace");
await expectError(() => db.query(`insert into storage.objects (bucket_id, name) values ('documents', '${A}/x/evil.pdf')`), "B cannot upload into A's storage folder");
const so = await db.query(`select count(*)::int n from storage.objects`);
ok(so.rows[0].n === 0, "B cannot list A's stored files");

// --- Cascade delete by owner
await as(A);
await db.query(`delete from workspaces where id = $1`, [ws.id]);
const left = await db.query(`select (select count(*) from document_chunks)::int c, (select count(*) from quiz_responses)::int r, (select count(*) from revision_tasks)::int t`);
ok(left.rows[0].c === 0 && left.rows[0].r === 0 && left.rows[0].t === 0, "deleting a workspace cascades to chunks, responses and tasks");

console.log(failures ? `\n${failures} FAILURE(S)` : "\nAll database checks passed");
process.exit(failures ? 1 : 0);
