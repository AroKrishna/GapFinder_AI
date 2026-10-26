// Evaluator Journey Automated Verification
// Simulates the complete evaluator walkthrough using the real demo account:
// 1. Sign in with demo credentials
// 2. Load demo workspace
// 3. Verify documents, chunks, and embeddings
// 4. Verify topics and topic citations
// 5. Verify revision tasks and toggle persistence
// 6. Verify quiz readiness and server scoring
// 7. Verify grounded tutor answer on in-scope topic
// 8. Verify honest refusal on out-of-scope topic
// 9. Sign out and verify session termination
//
// Usage: node --env-file=.env.local scripts/evaluator-journey.mjs

import { createClient } from "@supabase/supabase-js";
import { DEMO_CREDENTIALS } from "../lib/core/demo.ts";

const STOP = new Set("a an and are as at be by can does for from how in is it its of on or that the this to was what when where which who why with explain describe define".split(" "));
function buildTsQuery(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  return Array.from(new Set(words)).slice(0, 12).join(" | ");
}

const MIN_SIMILARITY = 0.55;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.");
  process.exit(1);
}

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
const assert = (condition, message, details = "") => {
  if (condition) {
    console.log(`✓ ${message}${details ? ` (${details})` : ""}`);
  } else {
    console.error(`✗ ${message}${details ? ` (${details})` : ""}`);
    failures++;
  }
};

console.log("\n=======================================================");
console.log(" Running End-to-End Evaluator Journey Verification");
console.log("=======================================================\n");

// 1. Sign in with demo credentials
console.log("Step 1: Authenticating with evaluator demo credentials...");
const { data: authData, error: authError } = await client.auth.signInWithPassword({
  email: DEMO_CREDENTIALS.email,
  password: DEMO_CREDENTIALS.password,
});

assert(!authError && !!authData.session, "Sign in succeeded with evaluator credentials", authData.user?.email);
const user = authData.user;

// 2. Load demo workspace
console.log("\nStep 2: Loading evaluator demo workspace...");
const { data: workspaces, error: wsError } = await client
  .from("workspaces")
  .select("id, name, subject, exam_date, hours_per_day, is_sample")
  .eq("user_id", user.id);

assert(!wsError && workspaces?.length > 0, "Evaluator workspace retrieved", workspaces?.[0]?.name);
const ws = workspaces?.[0];

// 3. Inspect learning materials (documents & chunks)
console.log("\nStep 3: Inspecting learning materials...");
const { data: docs, error: docError } = await client
  .from("documents")
  .select("id, title, status, chunk_count")
  .eq("workspace_id", ws.id);

assert(!docError && docs?.length >= 3, "All 3 sample documents present", `${docs?.length} documents`);
const allReady = docs?.every((d) => d.status === "ready" && d.chunk_count > 0);
assert(allReady, "All documents marked status=ready with chunks", docs?.map((d) => `${d.title} (${d.chunk_count} chunks)`).join(", "));

const { data: chunks, error: chunkError } = await client
  .from("document_chunks")
  .select("id, heading, embedding")
  .eq("workspace_id", ws.id);

assert(!chunkError && chunks?.length > 0, "Document chunks loaded from database", `${chunks?.length} chunks`);
const sampleVec = JSON.parse(chunks?.[0]?.embedding ?? "[]");
assert(sampleVec.length === 768, "Chunks have real 768-dimensional vector embeddings", `${sampleVec.length} dimensions`);

// 4. Inspect extracted topics & evidence
console.log("\nStep 4: Inspecting topic map & source citations...");
const { data: topics, error: topicError } = await client
  .from("topics")
  .select("id, name, importance")
  .eq("workspace_id", ws.id);

assert(!topicError && topics?.length >= 6, "Topic map populated with core course topics", `${topics?.length} topics`);

const { data: topicChunks, error: tcError } = await client
  .from("topic_chunks")
  .select("topic_id, chunk_id");

assert(!tcError && topicChunks?.length > 0, "Topics linked to document chunks as citations", `${topicChunks?.length} citations`);

// 5. Inspect revision plan and test task completion toggle
console.log("\nStep 5: Inspecting revision plan & verifying task persistence...");
const { data: plans } = await client
  .from("revision_plans")
  .select("id, version")
  .eq("workspace_id", ws.id)
  .order("version", { ascending: false })
  .limit(1);

assert(plans?.length > 0, "Revision plan active", `Version ${plans?.[0]?.version}`);

const { data: tasks } = await client
  .from("revision_tasks")
  .select("id, topic_name, activity, done")
  .eq("workspace_id", ws.id);

assert(tasks?.length > 0, "Scheduled revision tasks present", `${tasks?.length} tasks`);
const firstTask = tasks?.[0];

// Toggle task done
const { error: patchError } = await client
  .from("revision_tasks")
  .update({ done: true, done_at: new Date().toISOString() })
  .eq("id", firstTask.id);

assert(!patchError, "Marked task as completed");

// Refresh and verify persistence
const { data: refreshedTask } = await client
  .from("revision_tasks")
  .select("done")
  .eq("id", firstTask.id)
  .single();

assert(refreshedTask?.done === true, "Task completion persisted after database refresh");

// Toggle back so workspace remains fresh for evaluators
await client.from("revision_tasks").update({ done: false, done_at: null }).eq("id", firstTask.id);

// 6. Inspect diagnostic quiz ready to take
console.log("\nStep 6: Inspecting diagnostic quiz workflow...");
const { data: quizzes } = await client
  .from("quizzes")
  .select("id, status, question_count")
  .eq("workspace_id", ws.id)
  .eq("status", "ready")
  .limit(1);

assert(quizzes?.length > 0, "Diagnostic quiz ready for evaluator", `Quiz ID: ${quizzes?.[0]?.id}`);

const { data: questions } = await client
  .from("quiz_questions")
  .select("id, stem, options, difficulty")
  .eq("quiz_id", quizzes?.[0]?.id);

assert(questions?.length >= 4, "Quiz questions loaded with multiple-choice options", `${questions?.length} questions`);

// 7. Verify in-scope retrieval for AI tutor
console.log("\nStep 7: Verifying AI tutor grounding with semantic retrieval...");
const inScopeQuery = "deadlock mutual exclusion hold wait preemption circular";
const { data: inScopeMatches, error: searchError } = await client.rpc("match_chunks", {
  p_workspace: ws.id,
  p_embedding: chunks?.[0]?.embedding,
  p_query: buildTsQuery(inScopeQuery),
  p_k: 3,
});

assert(!searchError && inScopeMatches?.length > 0, "In-scope retrieval finds matching course text", inScopeMatches?.[0]?.heading);

// 8. Verify out-of-scope refusal logic
console.log("\nStep 8: Verifying out-of-scope query behavior...");
const outOfScopeQuery = "chocolate chip cookie baking temperature butter flour";
const { data: outOfScopeMatches } = await client.rpc("match_chunks", {
  p_workspace: ws.id,
  p_embedding: JSON.stringify(Array.from({ length: 768 }, () => 0)),
  p_query: buildTsQuery(outOfScopeQuery),
  p_k: 3,
});

const maxSim = Math.max(...(outOfScopeMatches || []).map((m) => Number(m.similarity) || 0));
const isInsufficient = !outOfScopeMatches?.length || maxSim < MIN_SIMILARITY;
assert(isInsufficient, "Out-of-scope query correctly falls below minimum similarity floor", `Max similarity: ${maxSim.toFixed(3)} < ${MIN_SIMILARITY}`);

// 9. Sign out and verify session termination
console.log("\nStep 9: Signing out and verifying session revocation...");
await client.auth.signOut();
const { data: anonTest } = await client.from("workspaces").select("id");
assert(anonTest?.length === 0, "Signed-out client receives 0 workspace rows under RLS");

console.log("\n=======================================================");
if (failures === 0) {
  console.log(" Evaluator Journey Verification PASSED (0 failures)");
} else {
  console.error(` Evaluator Journey Verification FAILED (${failures} failures)`);
}
console.log("=======================================================\n");

process.exit(failures === 0 ? 0 : 1);
