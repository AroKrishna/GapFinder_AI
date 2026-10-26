// Verifies the Supabase project is migrated and locked down. Prints no secrets.
// Usage: node --env-file=.env.local scripts/verify-setup.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const TABLES = [
  "profiles", "workspaces", "documents", "document_chunks", "topics", "topic_chunks", "quizzes", "quiz_questions",
  "quiz_responses", "topic_mastery", "mastery_history", "revision_plans", "revision_tasks", "study_activity",
  "tutor_messages", "ai_usage",
];

let failures = 0;
const ok = (cond, msg, detail = "") => {
  console.log(`${cond ? "✓" : "✗"} ${msg}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
};

const admin = createClient(url, secretKey, { auth: { persistSession: false } });
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

// 1. Tables exist (service role bypasses RLS, so this only checks existence).
for (const t of TABLES) {
  const { error } = await admin.from(t).select("*", { count: "exact", head: true });
  ok(!error, `table ${t}`, error?.message);
}

// 2. pgvector + hybrid retrieval RPC.
const zero = JSON.stringify(Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0)));
const rpc = await admin.rpc("match_chunks", {
  p_workspace: "00000000-0000-0000-0000-000000000000",
  p_embedding: zero,
  p_query: "test",
  p_k: 3,
});
ok(!rpc.error && Array.isArray(rpc.data), "match_chunks RPC + vector(768) type", rpc.error?.message);

// 3. Storage bucket is private.
const bucket = await admin.storage.getBucket("documents");
ok(!bucket.error && bucket.data?.public === false, "storage bucket 'documents' exists and is private", bucket.error?.message);

// 4. RLS: an anonymous client sees nothing and cannot write.
for (const t of ["workspaces", "documents", "document_chunks", "quiz_questions"]) {
  const { data, error } = await anon.from(t).select("id").limit(1);
  ok(!error && Array.isArray(data) && data.length === 0, `anon cannot read ${t}`, error?.message);
}
const ins = await anon.from("workspaces").insert({ name: "should fail" });
ok(!!ins.error, "anon cannot insert workspaces", ins.error ? "blocked as expected" : "INSERT SUCCEEDED");
const upl = await anon.storage.from("documents").upload(`anon-${Date.now()}.txt`, new Blob(["x"]), { contentType: "text/plain" });
ok(!!upl.error, "anon cannot upload to storage", upl.error ? "blocked as expected" : "UPLOAD SUCCEEDED");

console.log(failures ? `\n${failures} check(s) failed` : "\nSupabase setup verified");
process.exit(failures ? 1 : 0);
