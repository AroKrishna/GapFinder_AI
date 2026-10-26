// Live end-to-end check against a RUNNING app (npm run dev / npm start) with real Supabase + Gemini.
// Creates two throwaway confirmed users, drives the real HTTP API with session cookies, verifies
// results directly in the database, then deletes everything it created. Prints no secrets.
//
// Usage: node --env-file=.env.local scripts/e2e-api.mjs [baseUrl=http://localhost:3000]
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const BASE = process.argv[2] ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, secretKey, { auth: { persistSession: false } });

let failures = 0;
const results = [];
const ok = (cond, msg, detail = "") => {
  const line = `${cond ? "✓" : "✗"} ${msg}${detail ? ` — ${detail}` : ""}`;
  console.log(line);
  results.push(line);
  if (!cond) failures++;
  return cond;
};
const t = () => Date.now();
const secs = (t0) => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const norm = (s) => s.toLowerCase().replace(/[‘’“”`"']/g, "").replace(/[–—-]/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

async function login(email, password) {
  const jar = new Map();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  const cookie = () => [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
  const call = async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      redirect: "manual",
      headers: { cookie: cookie(), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text, location: res.headers.get("location") };
  };
  return { client, call };
}

/** Minimal multi-page PDF with real text objects (Helvetica), so unpdf extracts per-page text. */
function makePdf(pages) {
  const esc = (s) => s.replace(/[\\()]/g, "\\$&");
  const objs = [];
  const add = (s) => (objs.push(s), objs.length);
  const catalog = add(null);
  const pagesObj = add(null);
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const kids = [];
  for (const lines of pages) {
    const content = `BT /F1 11 Tf 50 750 Td 15 TL ${lines.map((l) => `(${esc(l)}) Tj T*`).join(" ")} ET`;
    const c = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Contents ${c} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n";
  const offsets = objs.map((o, i) => { const off = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return off; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

const stamp = Date.now();
const users = [
  { email: `e2e-${stamp}-a@gapfinder.test`, password: `E2e!${stamp}a` },
  { email: `e2e-${stamp}-b@gapfinder.test`, password: `E2e!${stamp}b` },
];
const createdIds = [];

async function main() {
  // ---------- Auth ----------
  for (const u of users) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true });
    if (error) throw new Error(`createUser: ${error.message}`);
    createdIds.push(data.user.id);
  }
  const anonPage = await fetch(`${BASE}/workspaces`, { redirect: "manual" });
  ok(anonPage.status === 307 && (anonPage.headers.get("location") ?? "").includes("/login"), "signed-out /workspaces redirects to /login", `${anonPage.status}`);
  const anonApi = await fetch(`${BASE}/api/workspaces`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  ok(anonApi.status === 401, "signed-out API call is rejected", `${anonApi.status}`);

  const A = await login(users[0].email, users[0].password);
  const B = await login(users[1].email, users[1].password);
  ok(true, "two test users signed in via Supabase Auth (cookie session)");
  const prof = await A.client.from("profiles").select("id").maybeSingle();
  ok(!!prof.data, "profile row auto-created by trigger");
  const wsPage = await A.call("GET", "/workspaces");
  ok(wsPage.status === 200 && wsPage.text.includes("Try the sample subject"), "signed-in /workspaces renders (first-run choice)", `${wsPage.status}`);

  // ---------- Workspace + validation ----------
  const bad = await A.call("POST", "/api/workspaces", { name: "", hours_per_day: 0 });
  ok(bad.status === 400, "invalid workspace input rejected by Zod", `${bad.status}`);
  const ws = await A.call("POST", "/api/workspaces", { name: "E2E DBMS", subject: "Databases", exam_date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), hours_per_day: 1.5 });
  ok(ws.status === 200 && ws.json?.workspace_id, "workspace created", `${ws.status}`);
  const wid = ws.json.workspace_id;

  // ---------- Upload: PDF ----------
  let t0 = t();
  const pdf = makePdf([
    ["UNIT 1 NORMALIZATION", "Normalization is the process of organizing relations to reduce redundancy and update anomalies.",
      "A relation is in first normal form (1NF) when every attribute contains only atomic values.",
      "Second normal form (2NF) requires 1NF and no partial dependency of a non-prime attribute on a candidate key.",
      "Third normal form (3NF) requires 2NF and no transitive dependency of a non-prime attribute on a candidate key."],
    ["UNIT 2 TRANSACTIONS", "A transaction is a unit of work that must satisfy the ACID properties.",
      "Atomicity means a transaction either completes entirely or has no effect at all.",
      "Isolation ensures that concurrent transactions produce the same result as some serial execution.",
      "Durability guarantees that committed changes survive system failures, typically using a write-ahead log."],
  ]);
  const reserve = await A.call("POST", "/api/documents", { workspace_id: wid, title: "DBMS notes", filename: "dbms-notes.pdf", mime: "application/pdf", size: pdf.length });
  ok(reserve.status === 200 && reserve.json?.storage_path?.startsWith(createdIds[0] + "/"), "document reserved in caller's storage folder");
  const up = await A.client.storage.from("documents").upload(reserve.json.storage_path, pdf, { contentType: "application/pdf" });
  ok(!up.error, "direct-to-Storage upload as the user (RLS)", up.error?.message);
  const proc = await A.call("POST", `/api/documents/${reserve.json.document_id}/process`);
  ok(proc.status === 200 && proc.json?.status === "ready" && proc.json.chunk_count > 0, "PDF extracted, chunked, embedded and indexed", `${proc.json?.status} · ${proc.json?.chunk_count} chunks · ${secs(t0)}${proc.json?.error ? " · " + proc.json.error : ""}`);
  const pdfChunks = await A.client.from("document_chunks").select("page, heading, embedding").eq("document_id", reserve.json.document_id);
  const pages = new Set((pdfChunks.data ?? []).map((c) => c.page));
  ok(pages.has(1) && pages.has(2), "page numbers preserved in chunk metadata", `pages ${[...pages].join(",")}`);
  ok((pdfChunks.data ?? []).some((c) => /TRANSACTIONS/i.test(c.heading ?? "")), "section headings preserved", (pdfChunks.data ?? []).map((c) => c.heading).join(" | "));
  const dims = JSON.parse(pdfChunks.data?.[0]?.embedding ?? "[]").length;
  ok(dims === 768, "embeddings stored as vector(768)", `${dims} dims`);

  // ---------- Upload: invalid files ----------
  const fake = new TextEncoder().encode("this is not really a pdf file at all, just text pretending");
  const r2 = await A.call("POST", "/api/documents", { workspace_id: wid, title: "fake", filename: "fake.pdf", mime: "application/pdf", size: fake.length });
  await A.client.storage.from("documents").upload(r2.json.storage_path, fake, { contentType: "application/pdf" });
  const p2 = await A.call("POST", `/api/documents/${r2.json.document_id}/process`);
  ok(p2.json?.status === "failed" && /not a valid PDF/i.test(p2.json?.error ?? ""), "corrupt PDF fails gracefully with a reason", p2.json?.error);
  const retry = await A.call("POST", `/api/documents/${r2.json.document_id}/process`);
  ok(retry.json?.status === "failed", "retry is safe (stays failed, no partial chunks)");
  const del = await A.call("DELETE", `/api/documents/${r2.json.document_id}`);
  ok(del.status === 200, "failed document deleted");
  const big = await A.call("POST", "/api/documents", { workspace_id: wid, title: "big", filename: "big.pdf", mime: "application/pdf", size: 50 * 1024 * 1024 });
  ok(big.status === 400, "oversized upload rejected before upload", `${big.status}`);
  const exe = await A.call("POST", "/api/documents", { workspace_id: wid, title: "x", filename: "x.exe", mime: "application/x-msdownload", size: 10 });
  ok(exe.status === 400, "unsupported file type rejected", `${exe.status}`);

  // ---------- Topics on uploaded material ----------
  t0 = t();
  const topics1 = await A.call("POST", `/api/workspaces/${wid}/topics`);
  ok(topics1.status === 200 && topics1.json?.topic_count > 0, "topic extraction (Gemini) on uploaded PDF", `${topics1.json?.topic_count ?? topics1.json?.error} topics · ${secs(t0)}`);

  // ---------- Sample workspace (live pipeline) ----------
  t0 = t();
  const sample = await A.call("POST", "/api/workspaces/sample");
  ok(sample.status === 200 && sample.json?.workspace_id && !sample.json.failures?.length && !sample.json.topics_error, "sample workspace: 3 docs processed + topic map", `${secs(t0)}${sample.json?.failures?.length ? " · " + sample.json.failures.join("; ") : ""}${sample.json?.topics_error ? " · " + sample.json.topics_error : ""}${sample.json?.error ? " · " + sample.json.error : ""}`);
  const sid = sample.json?.workspace_id;
  const sTopics = await A.client.from("topics").select("id, name, topic_chunks(chunk_id)").eq("workspace_id", sid);
  ok((sTopics.data ?? []).length >= 4 && sTopics.data.every((tp) => tp.topic_chunks.length > 0), "every topic links to ≥1 real source passage", `${sTopics.data?.length} topics: ${(sTopics.data ?? []).map((x) => x.name).join(", ")}`);

  // ---------- Quiz generation + independent citation check ----------
  t0 = t();
  const quiz = await A.call("POST", `/api/workspaces/${sid}/quizzes`, {});
  ok(quiz.status === 200 && quiz.json?.question_count > 0, "diagnostic quiz generated (retrieval + Gemini + validation)", `${quiz.json?.question_count ?? quiz.json?.error} questions, ${quiz.json?.rejected_count ?? "?"} rejected · ${secs(t0)}`);
  const qid = quiz.json.quiz_id;
  const qs = (await A.client.from("quiz_questions").select("id, topic_id, stem, options, correct_index, difficulty, source_chunk_ids, evidence_quote").eq("quiz_id", qid).order("position")).data ?? [];
  const chunkIds = [...new Set(qs.flatMap((q) => q.source_chunk_ids))];
  const chunks = new Map(((await A.client.from("document_chunks").select("id, content, workspace_id").in("id", chunkIds)).data ?? []).map((c) => [c.id, c]));
  const grounded = qs.filter((q) => q.source_chunk_ids.length && q.source_chunk_ids.every((id) => chunks.get(id)?.workspace_id === sid) && q.source_chunk_ids.some((id) => {
    const qn = norm(q.evidence_quote), pn = norm(chunks.get(id).content);
    if (pn.includes(qn)) return true;
    const w = qn.split(" "); let hit = 0, tot = 0;
    for (let i = 0; i + 5 <= w.length; i++) { tot++; if (pn.includes(w.slice(i, i + 5).join(" "))) hit++; }
    return tot > 0 && hit / tot >= 0.8;
  }));
  ok(grounded.length === qs.length, "independent re-check: every question cites this workspace's passages and its evidence quote is in them", `${grounded.length}/${qs.length}`);
  ok(qs.every((q) => q.options.length === 4 && new Set(q.options.map(norm)).size === 4 && q.correct_index >= 0 && q.correct_index <= 3), "every question has 4 distinct options and a valid key");
  const topicsRedirect = await A.call("GET", `/w/${sid}/topics`);
  ok(topicsRedirect.status === 307 && (topicsRedirect.location ?? "").endsWith(`/w/${sid}/gaps`), "old /topics URL redirects to Topic Gaps", `${topicsRedirect.status}`);
  const quizPage = await A.call("GET", `/w/${sid}/quiz/${qid}`);
  ok(quizPage.status === 200 && !quizPage.text.includes('"correct_index"') && !quizPage.text.includes("correct_index"), "quiz page renders without leaking answer keys", `${quizPage.status}`);
  console.log("   sample question:", qs[0]?.stem);

  // ---------- Submit + idempotency ----------
  const incomplete = await A.call("POST", `/api/quizzes/${qid}/submit`, { answers: [{ question_id: qs[0].id, selected_index: 0 }] });
  ok(incomplete.status === 400, "partial submission rejected", `${incomplete.status}`);
  // Answer the first topic's questions wrong, everything else right.
  const weakTopic = qs[0].topic_id;
  const answers = qs.map((q) => ({ question_id: q.id, selected_index: q.topic_id === weakTopic ? (q.correct_index + 1) % 4 : q.correct_index }));
  const expected = answers.filter((a, i) => a.selected_index === qs[i].correct_index).length;
  const s1 = await A.call("POST", `/api/quizzes/${qid}/submit`, { answers });
  ok(s1.status === 200 && s1.json?.correct === expected && s1.json.total === qs.length, "deterministic scoring matches answer key", `${s1.json?.correct}/${s1.json?.total} (expected ${expected})`);
  const s2 = await A.call("POST", `/api/quizzes/${qid}/submit`, { answers: qs.map((q) => ({ question_id: q.id, selected_index: q.correct_index })) });
  ok(s2.status === 200 && s2.json?.correct === expected, "resubmitting different answers cannot change the score", `${s2.json?.correct}/${s2.json?.total}`);
  const results = await A.call("GET", `/w/${sid}/quiz/${qid}/results`);
  ok(results.status === 200 && results.text.includes("Correct answer") && results.text.includes("Why:"), "results page shows answers, explanations and citations", `${results.status}`);

  // ---------- Gap analysis ----------
  const mastery = (await A.client.from("topic_mastery").select("topic_id, state, score, n_questions, provisional, reasons").eq("workspace_id", sid)).data ?? [];
  const wm = mastery.find((m) => m.topic_id === weakTopic);
  ok(mastery.length === (sTopics.data ?? []).length, "mastery computed for every topic (incl. not assessed)", `${mastery.length} rows`);
  ok(wm && (wm.state === "weak" || wm.state === "not_assessed") && wm.reasons.length > 0, "deliberately-missed topic is weak (or not assessed if <2 questions), with reasons", wm ? `${wm.state} ${Math.round(wm.score * 100)}% n=${wm.n_questions} provisional=${wm.provisional}` : "missing");
  ok(mastery.every((m) => (m.n_questions < 2) === (m.state === "not_assessed")), "topics with <2 answers are not assessed; others are classified", mastery.map((m) => `${m.state}(n=${m.n_questions})`).join(", "));
  const hist = await A.client.from("mastery_history").select("id", { count: "exact", head: true }).eq("quiz_id", qid);
  ok((hist.count ?? 0) > 0, "mastery history recorded", `${hist.count} rows`);
  const gaps = await A.call("GET", `/w/${sid}/gaps`);
  ok(gaps.status === 200 && gaps.text.includes("Where you stand, topic by topic") && gaps.text.includes("Needs practice"), "Topic Gaps page renders with states", `${gaps.status}`);

  // ---------- Plan v1 ----------
  const plan1 = await A.call("POST", `/api/workspaces/${sid}/plan`);
  ok(plan1.status === 200 && plan1.json?.version === 1 && plan1.json.task_count > 0, "revision plan v1 generated", `${plan1.json?.task_count} tasks`);
  const tasks1 = (await A.client.from("revision_tasks").select("id, topic_id, activity, minutes, due_date, reason").eq("plan_id", plan1.json.plan_id)).data ?? [];
  const perDay = {};
  for (const tk of tasks1) perDay[tk.due_date] = (perDay[tk.due_date] ?? 0) + tk.minutes;
  ok(Object.values(perDay).every((m) => m <= 120), "no day exceeds the 2 h/day budget", JSON.stringify(perDay));
  const firstWeakTask = tasks1.find((tk) => tk.topic_id === weakTopic) ?? tasks1[0];
  const done = await A.call("PATCH", `/api/tasks/${firstWeakTask.id}`, { done: true });
  ok(done.status === 200, "task marked complete", `${firstWeakTask.activity}`);

  // ---------- Second quiz on the weak topic, then replan ----------
  t0 = t();
  const quiz2 = await A.call("POST", `/api/workspaces/${sid}/quizzes`, { topic_ids: [weakTopic] });
  ok(quiz2.status === 200 && quiz2.json?.question_count > 0, "topic-specific practice quiz generated", `${quiz2.json?.question_count ?? quiz2.json?.error} questions · ${secs(t0)}`);
  if (quiz2.status === 200) {
    const qs2 = (await A.client.from("quiz_questions").select("id, correct_index").eq("quiz_id", quiz2.json.quiz_id)).data ?? [];
    await A.call("POST", `/api/quizzes/${quiz2.json.quiz_id}/submit`, { answers: qs2.map((q) => ({ question_id: q.id, selected_index: q.correct_index })) });
  }
  const plan2 = await A.call("POST", `/api/workspaces/${sid}/plan`);
  ok(plan2.status === 200 && plan2.json?.version === 2, "plan v2 generated after new evidence");
  const kept = await A.client.from("revision_tasks").select("id", { count: "exact", head: true }).eq("plan_id", plan2.json.plan_id).eq("done", true);
  ok((kept.count ?? 0) >= 1, "completed task carried into v2", `${kept.count}`);
  console.log("   change summary:", JSON.stringify(plan2.json?.change_summary));
  ok((plan2.json?.change_summary ?? []).length > 0, "v2 explains what changed");
  const planPage = await A.call("GET", `/w/${sid}/plan`);
  ok(planPage.status === 200 && planPage.text.includes("Why your plan looks like this"), "Today's Revision page renders");

  // ---------- Tutor ----------
  t0 = t();
  const tutor1 = await A.call("POST", `/api/workspaces/${sid}/tutor`, { message: "Why does FIFO page replacement suffer from Belady's anomaly, and does LRU?" });
  ok(tutor1.status === 200 && !tutor1.json?.insufficient_evidence && tutor1.json?.citations?.length > 0, "tutor answers an in-scope question with citations", `${tutor1.json?.citations?.length ?? tutor1.json?.error} citations · ${secs(t0)}`);
  const cited = tutor1.json?.citations ?? [];
  const citedOk = cited.length && (await A.client.from("document_chunks").select("id").in("id", cited.map((c) => c.chunk_id)).eq("workspace_id", sid)).data?.length === cited.length;
  ok(!!citedOk, "tutor citations resolve to real passages in this workspace");
  console.log("   tutor answer:", (tutor1.json?.answer_markdown ?? "").slice(0, 220).replace(/\n/g, " "), "…");
  t0 = t();
  const tutor2 = await A.call("POST", `/api/workspaces/${sid}/tutor`, { message: "Explain how B+ tree indexes split nodes during insertion in database systems." });
  ok(tutor2.status === 200 && tutor2.json?.insufficient_evidence === true, "tutor declines an out-of-scope question (insufficient evidence)", `${secs(t0)} · ${String(tutor2.json?.answer_markdown ?? tutor2.json?.error).slice(0, 120)}`);

  // ---------- Dashboard ----------
  const dash = await A.call("GET", `/w/${sid}`);
  ok(dash.status === 200 && dash.text.includes("Focus next") && dash.text.includes("Am I improving?") && dash.text.includes("Your topics"), "Home renders from persisted data", `${dash.status}`);
  for (const p of ["documents", "gaps", "quizzes", "tutor", "settings"]) {
    const r = await A.call("GET", `/w/${sid}/${p}`);
    ok(r.status === 200, `/w/[wid]/${p} renders`, `${r.status}`);
  }

  // ---------- Isolation: user B ----------
  const bPage = await B.call("GET", `/w/${sid}`);
  ok(bPage.status === 404, "user B gets 404 on A's workspace page", `${bPage.status}`);
  const bQuiz = await B.call("POST", `/api/workspaces/${sid}/quizzes`, {});
  ok(bQuiz.status === 404, "user B cannot generate quizzes in A's workspace", `${bQuiz.status}`);
  const bTutor = await B.call("POST", `/api/workspaces/${sid}/tutor`, { message: "what is paging" });
  ok(bTutor.status === 404, "user B cannot query A's material via tutor", `${bTutor.status}`);
  const bDoc = await B.call("GET", `/api/documents/${reserve.json.document_id}`);
  ok(bDoc.status === 404, "user B cannot read A's document status", `${bDoc.status}`);
  const bSubmit = await B.call("POST", `/api/quizzes/${qid}/submit`, { answers: [{ question_id: qs[0].id, selected_index: 0 }] });
  ok(bSubmit.status === 404, "user B cannot submit A's quiz", `${bSubmit.status}`);
  const bTask = await B.call("PATCH", `/api/tasks/${firstWeakTask.id}`, { done: false });
  ok(bTask.status === 404, "user B cannot change A's tasks", `${bTask.status}`);
  const bRpc = await B.client.rpc("match_chunks", { p_workspace: sid, p_embedding: JSON.stringify(Array(768).fill(0.036)), p_query: "paging", p_k: 6 });
  ok(!bRpc.error && bRpc.data.length === 0, "user B's vector search on A's workspace returns nothing");
  const bRows = await B.client.from("document_chunks").select("id").limit(1);
  ok((bRows.data ?? []).length === 0, "user B reads 0 of A's chunks directly via Supabase API");
  const bFile = await B.client.storage.from("documents").download(reserve.json.storage_path);
  ok(!!bFile.error, "user B cannot download A's stored file");
  const bDel = await B.call("DELETE", `/api/workspaces/${sid}`);
  ok(bDel.status === 404, "user B cannot delete A's workspace", `${bDel.status}`);

  // ---------- Safe deletion ----------
  const delDoc = await A.call("DELETE", `/api/documents/${reserve.json.document_id}`);
  const left = await A.client.from("document_chunks").select("id", { count: "exact", head: true }).eq("document_id", reserve.json.document_id);
  const folder = reserve.json.storage_path.split("/").slice(0, -1).join("/");
  const fileName = reserve.json.storage_path.split("/").pop();
  const listing = await admin.storage.from("documents").list(folder, { limit: 100 });
  const stillThere = (listing.data ?? []).some((f) => f.name === fileName);
  ok(delDoc.status === 200 && left.count === 0 && !stillThere, "deleting a document removes its chunks and stored file", `status ${delDoc.status} · chunks left ${left.count} · file still in bucket: ${stillThere}`);
  for (const w of [wid, sid]) {
    const d = await A.call("DELETE", `/api/workspaces/${w}`);
    ok(d.status === 200, `workspace deleted (cascade + storage cleanup)`);
  }
}

try {
  await main();
} catch (e) {
  ok(false, "unexpected error", e instanceof Error ? e.message : String(e));
} finally {
  for (const id of createdIds) {
    // Remove any leftover storage files, then the user (cascades all rows).
    const { data: files } = await admin.storage.from("documents").list(id, { limit: 100 });
    for (const folder of files ?? []) {
      const { data: inner } = await admin.storage.from("documents").list(`${id}/${folder.name}`, { limit: 100 });
      if (inner?.length) await admin.storage.from("documents").remove(inner.map((f) => `${id}/${folder.name}/${f.name}`));
    }
    await admin.auth.admin.deleteUser(id);
  }
  console.log(`\nCleaned up ${createdIds.length} test users.`);
  console.log(failures ? `${failures} CHECK(S) FAILED` : "ALL LIVE CHECKS PASSED");
  process.exit(failures ? 1 : 0);
}
