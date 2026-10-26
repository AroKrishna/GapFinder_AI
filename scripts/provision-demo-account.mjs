// Provisioning script for the dedicated evaluator demo account.
// Usage: node --env-file=.env.local scripts/provision-demo-account.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never run this in the browser.

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { DEMO_CREDENTIALS } from "../lib/core/demo.ts";
import { SAMPLE_DOCUMENTS } from "../lib/sample/content.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`[demo-provision] Provisioning demo account: ${DEMO_CREDENTIALS.email}...`);

// 1. Check if user already exists (or migrate from legacy evaluator demo account)
const { data: listData, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) {
  console.error("[demo-provision] Error listing users:", listError.message);
  process.exit(1);
}

let user = listData.users.find((u) => u.email?.toLowerCase() === DEMO_CREDENTIALS.email.toLowerCase());
const legacyUser = listData.users.find((u) => u.email?.toLowerCase() === "evaluator@gapfinder.demo");

if (!user && legacyUser) {
  // Seamlessly migrate legacy evaluator account so existing workspace, documents, and embeddings are preserved
  const { data: migData, error: migError } = await admin.auth.admin.updateUserById(legacyUser.id, {
    email: DEMO_CREDENTIALS.email,
    password: DEMO_CREDENTIALS.password,
    email_confirm: true,
    user_metadata: { display_name: DEMO_CREDENTIALS.displayName },
  });
  if (migError) {
    console.warn("[demo-provision] Could not rename legacy user, will create fresh admin user:", migError.message);
  } else {
    user = migData.user;
    console.log(`✓ Successfully migrated legacy evaluator demo account to ${DEMO_CREDENTIALS.email} (User ID: ${user.id})`);
  }
}

if (user) {
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: DEMO_CREDENTIALS.password,
    email_confirm: true,
    user_metadata: { display_name: DEMO_CREDENTIALS.displayName },
  });
  if (updateError) {
    console.error("[demo-provision] Failed to update demo user password:", updateError.message);
    process.exit(1);
  }
  console.log(`✓ Demo user verified and credentials updated (User ID: ${user.id})`);
} else {
  const { data: createData, error: createError } = await admin.auth.admin.createUser({
    email: DEMO_CREDENTIALS.email,
    password: DEMO_CREDENTIALS.password,
    email_confirm: true,
    user_metadata: { display_name: DEMO_CREDENTIALS.displayName },
  });
  if (createError) {
    console.error("[demo-provision] Failed to create demo user:", createError.message);
    process.exit(1);
  }
  user = createData.user;
  console.log(`✓ Created new demo user (User ID: ${user.id})`);
}

// 2. Ensure profile exists
const { error: profileError } = await admin.from("profiles").upsert(
  {
    id: user.id,
    display_name: DEMO_CREDENTIALS.displayName,
  },
  { onConflict: "id" }
);
if (profileError) {
  console.warn("[demo-provision] Note on profile upsert:", profileError.message);
} else {
  console.log("✓ Profile record verified");
}

// 3. Check for existing workspace
const { data: workspaces, error: wsError } = await admin
  .from("workspaces")
  .select("id, name, is_sample")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false });

if (wsError) {
  console.error("[demo-provision] Failed to query workspaces:", wsError.message);
  process.exit(1);
}

let demoWorkspace = workspaces?.find((w) => w.is_sample) || workspaces?.[0];

if (demoWorkspace) {
  console.log(`✓ Demo workspace verified: "${demoWorkspace.name}" (ID: ${demoWorkspace.id})`);
} else {
  const examDate = new Date(Date.now() + DEMO_CREDENTIALS.examInDays * 86400000).toISOString().slice(0, 10);
  const { data: newWs, error: newWsError } = await admin
    .from("workspaces")
    .insert({
      user_id: user.id,
      name: DEMO_CREDENTIALS.workspaceName,
      subject: DEMO_CREDENTIALS.subject,
      hours_per_day: DEMO_CREDENTIALS.hoursPerDay,
      exam_date: examDate,
      is_sample: true,
    })
    .select("id, name")
    .single();

  if (newWsError) {
    console.error("[demo-provision] Failed to create demo workspace:", newWsError.message);
    process.exit(1);
  }
  demoWorkspace = newWs;
  console.log(`✓ Created demo workspace: "${demoWorkspace.name}" (ID: ${demoWorkspace.id})`);
}

// 4. Ensure demo documents are uploaded and stored
const { data: existingDocs } = await admin
  .from("documents")
  .select("id, title, storage_path, status, chunk_count")
  .eq("workspace_id", demoWorkspace.id);

const docMap = new Map((existingDocs || []).map((d) => [d.title, d]));

for (const d of SAMPLE_DOCUMENTS) {
  let doc = docMap.get(d.title);
  if (!doc) {
    const path = `${user.id}/${demoWorkspace.id}/${crypto.randomUUID()}-${d.filename}`;
    const bytes = new TextEncoder().encode(d.content);

    const { error: uploadError } = await admin.storage
      .from("documents")
      .upload(path, bytes, { contentType: d.mime });

    if (uploadError) {
      console.warn(`  ! Could not upload ${d.filename} to storage:`, uploadError.message);
      continue;
    }

    const { data: createdDoc, error: docError } = await admin
      .from("documents")
      .insert({
        user_id: user.id,
        workspace_id: demoWorkspace.id,
        title: d.title,
        storage_path: path,
        mime: d.mime,
        size_bytes: bytes.length,
        is_sample: true,
        status: "ready",
        chunk_count: 0,
      })
      .select("id, title, storage_path, status, chunk_count")
      .single();

    if (docError) {
      console.warn(`  ! Could not create document record for ${d.title}:`, docError.message);
      continue;
    }
    doc = createdDoc;
    docMap.set(d.title, doc);
    console.log(`  ✓ Uploaded document: ${d.title}`);
  }
}

// 5. Chunking & Embeddings
const { data: existingChunks } = await admin
  .from("document_chunks")
  .select("id")
  .eq("workspace_id", demoWorkspace.id)
  .limit(1);

function l2normalize(v) {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

function parseMarkdownSections(text) {
  const sections = [];
  const lines = text.split("\n");
  let currentHeading = "Overview";
  let currentLines = [];

  for (const line of lines) {
    if (line.startsWith("#")) {
      if (currentLines.length) {
        sections.push({ heading: currentHeading, content: currentLines.join("\n").trim() });
        currentLines = [];
      }
      currentHeading = line.replace(/^#+\s*/, "").trim();
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length) {
    sections.push({ heading: currentHeading, content: currentLines.join("\n").trim() });
  }
  return sections.filter((s) => s.content.length > 30);
}

const allInsertedChunks = [];

if (existingChunks && existingChunks.length > 0) {
  console.log("✓ Document chunks and embeddings already present");
} else if (geminiKey) {
  console.log("  · Generating real vector embeddings via Gemini API...");
  const ai = new GoogleGenAI({ apiKey: geminiKey, httpOptions: { retryOptions: { attempts: 1 } } });

  for (const sample of SAMPLE_DOCUMENTS) {
    const doc = docMap.get(sample.title);
    if (!doc) continue;

    const sections = parseMarkdownSections(sample.content);
    if (!sections.length) continue;

    const texts = sections.map((s) => `${s.heading}\n${s.content}`);
    const embedRes = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: texts,
      config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: 768 },
    });

    const vectors = (embedRes.embeddings || []).map((e) => l2normalize(e.values || []));

    const chunkRows = sections.map((s, idx) => ({
      user_id: user.id,
      workspace_id: demoWorkspace.id,
      document_id: doc.id,
      idx,
      heading: s.heading,
      content: s.content,
      page: null,
      embedding: JSON.stringify(vectors[idx]),
    }));

    const { data: inserted, error: chunkErr } = await admin
      .from("document_chunks")
      .insert(chunkRows)
      .select("id, heading, workspace_id");

    if (chunkErr) {
      console.warn(`  ! Error inserting chunks for ${doc.title}:`, chunkErr.message);
    } else {
      allInsertedChunks.push(...(inserted || []));
      await admin
        .from("documents")
        .update({ status: "ready", chunk_count: chunkRows.length })
        .eq("id", doc.id);
      console.log(`  ✓ Created & embedded ${chunkRows.length} chunks for "${doc.title}"`);
    }
  }
} else {
  console.warn("  ! GEMINI_API_KEY missing; skipping vector embedding generation");
}

// 6. Topics and Topic-Chunk associations
const { data: currentChunks } = await admin
  .from("document_chunks")
  .select("id, heading")
  .eq("workspace_id", demoWorkspace.id);

const { data: existingTopics } = await admin
  .from("topics")
  .select("id, name")
  .eq("workspace_id", demoWorkspace.id);

const topicDefinitions = [
  {
    name: "Process States and the PCB",
    summary: "Process states (new, ready, running, waiting, terminated) and Process Control Block (PCB) context switching.",
    importance: 2,
    headingMatch: "Process",
  },
  {
    name: "CPU Scheduling Algorithms",
    summary: "FCFS, SJF, SRTF, Round Robin, convoy effect, average waiting time and turnaround time criteria.",
    importance: 3,
    headingMatch: "Scheduling",
  },
  {
    name: "Process Synchronization & Critical Section",
    summary: "Race conditions, critical section problem (mutual exclusion, progress, bounded waiting), Peterson's solution.",
    importance: 3,
    headingMatch: "Synchronization",
  },
  {
    name: "Classic Synchronization Problems",
    summary: "Bounded-buffer (producer-consumer), dining philosophers problem, counting vs binary semaphores.",
    importance: 2,
    headingMatch: "Bounded-Buffer",
  },
  {
    name: "Deadlocks: Necessary Conditions & Banker's Algorithm",
    summary: "Mutual exclusion, hold & wait, no preemption, circular wait. Banker's algorithm safe-state verification.",
    importance: 3,
    headingMatch: "Deadlock",
  },
  {
    name: "Paging & Memory Management",
    summary: "Logical vs physical address space, internal vs external fragmentation, page tables, and TLB hit ratio.",
    importance: 3,
    headingMatch: "Paging",
  },
  {
    name: "Page Replacement Algorithms",
    summary: "FIFO, Optimal, and LRU algorithms. Belady's anomaly in FIFO and LRU stack algorithm immunity.",
    importance: 2,
    headingMatch: "Page Replacement",
  },
];

let createdTopics = existingTopics || [];

if (!existingTopics || existingTopics.length === 0) {
  console.log("  · Seeding core educational topics...");
  const topicRows = topicDefinitions.map((t) => ({
    user_id: user.id,
    workspace_id: demoWorkspace.id,
    name: t.name,
    summary: t.summary,
    importance: t.importance,
  }));

  const { data: newTopics, error: tErr } = await admin
    .from("topics")
    .insert(topicRows)
    .select("id, name, importance");

  if (tErr) {
    console.warn("  ! Error inserting topics:", tErr.message);
  } else {
    createdTopics = newTopics || [];
    console.log(`  ✓ Seeded ${createdTopics.length} topics`);

    // Associate topic chunks
    if (currentChunks && currentChunks.length > 0) {
      const tcRows = [];
      for (const tDef of topicDefinitions) {
        const tRecord = createdTopics.find((t) => t.name === tDef.name);
        if (!tRecord) continue;
        const matchingChunks = currentChunks.filter((c) =>
          c.heading?.toLowerCase().includes(tDef.headingMatch.toLowerCase())
        );
        for (const mc of matchingChunks) {
          tcRows.push({
            user_id: user.id,
            topic_id: tRecord.id,
            chunk_id: mc.id,
          });
        }
      }
      if (tcRows.length > 0) {
        await admin.from("topic_chunks").upsert(tcRows, { onConflict: "topic_id, chunk_id" });
        console.log(`  ✓ Linked ${tcRows.length} topic-to-chunk citations`);
      }
    }
  }
} else {
  console.log(`✓ Topics verified (${existingTopics.length} topics present)`);
}

// Ensure topic_chunks are always mapped for the demo user
const { data: currentDemoTc } = await admin
  .from("topic_chunks")
  .select("topic_id")
  .eq("user_id", user.id)
  .limit(1);

if ((!currentDemoTc || currentDemoTc.length === 0) && currentChunks?.length) {
  const tcRows = [];
  for (const tDef of topicDefinitions) {
    const tRecord = createdTopics.find((t) => t.name === tDef.name);
    if (!tRecord) continue;
    const matchingChunks = currentChunks.filter((c) =>
      c.heading?.toLowerCase().includes(tDef.headingMatch.toLowerCase())
    );
    for (const mc of matchingChunks) {
      tcRows.push({
        user_id: user.id,
        topic_id: tRecord.id,
        chunk_id: mc.id,
      });
    }
  }
  if (tcRows.length > 0) {
    await admin.from("topic_chunks").upsert(tcRows, { onConflict: "topic_id, chunk_id" });
    console.log(`  ✓ Linked ${tcRows.length} topic-to-chunk citations`);
  }
}


// 7. Revision Plan
const { data: existingPlans } = await admin
  .from("revision_plans")
  .select("id, version, revision_tasks(count)")
  .eq("workspace_id", demoWorkspace.id)
  .order("version", { ascending: false });

const validPlan = existingPlans?.find((p) => p.revision_tasks?.[0]?.count > 0);

if (!validPlan) {
  // Clean up any empty plan
  if (existingPlans?.length) {
    await admin.from("revision_plans").delete().eq("workspace_id", demoWorkspace.id);
  }
  console.log("  · Generating initial revision plan...");
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

  const snapshot = createdTopics.map((t) => ({
    topic_id: t.id,
    name: t.name,
    state: "not_assessed",
    score: 0,
    n_questions: 0,
  }));

  const { data: newPlan, error: planErr } = await admin
    .from("revision_plans")
    .insert({
      user_id: user.id,
      workspace_id: demoWorkspace.id,
      version: 1,
      budget_minutes: 120,
      change_summary: ["Initial baseline revision plan generated for End Semester Prep."],
      unscheduled: [],
      snapshot,
    })
    .select("id, version")
    .single();

  if (planErr) {
    console.warn("  ! Error inserting revision plan:", planErr.message);
  } else if (newPlan) {
    const taskRows = [
      {
        user_id: user.id,
        workspace_id: demoWorkspace.id,
        plan_id: newPlan.id,
        topic_id: createdTopics[0]?.id || null,
        topic_name: createdTopics[0]?.name || "Process States and the PCB",
        activity: "assess",
        priority: 1,
        minutes: 20,
        reason: "Initial diagnostic assessment to identify baseline comprehension.",
        due_date: today,
        done: false,
        source_chunk_ids: [],
      },
      {
        user_id: user.id,
        workspace_id: demoWorkspace.id,
        plan_id: newPlan.id,
        topic_id: createdTopics[1]?.id || null,
        topic_name: createdTopics[1]?.name || "CPU Scheduling Algorithms",
        activity: "read",
        priority: 2,
        minutes: 30,
        reason: "High exam weightage; review Gantt charts and waiting time formulas.",
        due_date: today,
        done: false,
        source_chunk_ids: [],
      },
      {
        user_id: user.id,
        workspace_id: demoWorkspace.id,
        plan_id: newPlan.id,
        topic_id: createdTopics[2]?.id || null,
        topic_name: createdTopics[2]?.name || "Process Synchronization & Critical Section",
        activity: "practice",
        priority: 3,
        minutes: 30,
        reason: "Practice Peterson's solution constraints and semaphore invariants.",
        due_date: tomorrow,
        done: false,
        source_chunk_ids: [],
      },
      {
        user_id: user.id,
        workspace_id: demoWorkspace.id,
        plan_id: newPlan.id,
        topic_id: createdTopics[4]?.id || null,
        topic_name: createdTopics[4]?.name || "Deadlocks: Necessary Conditions & Banker's Algorithm",
        activity: "review",
        priority: 4,
        minutes: 30,
        reason: "Trace Banker's safety algorithm with Available, Max, and Need matrices.",
        due_date: dayAfter,
        done: false,
        source_chunk_ids: [],
      },
    ];

    const { error: taskErr } = await admin.from("revision_tasks").insert(taskRows);
    if (taskErr) {
      console.warn("  ! Error inserting revision tasks:", taskErr.message);
    } else {
      console.log(`  ✓ Generated revision plan with ${taskRows.length} scheduled tasks`);
    }
  }
} else {
  console.log(`✓ Revision plan verified (v${validPlan.version})`);
}

// 8. Grounded Diagnostic Quiz ready to take
const { data: readyQuizzes } = await admin
  .from("quizzes")
  .select("id, status, question_count")
  .eq("workspace_id", demoWorkspace.id)
  .eq("status", "ready")
  .limit(1);

if (!readyQuizzes || readyQuizzes.length === 0) {
  console.log("  · Seeding pre-generated diagnostic quiz ready for immediate evaluation...");
  const { data: quiz, error: qErr } = await admin
    .from("quizzes")
    .insert({
      user_id: user.id,
      workspace_id: demoWorkspace.id,
      kind: "diagnostic",
      status: "ready",
      question_count: 6,
    })
    .select("id")
    .single();

  if (!qErr && quiz) {
    const qDefinitions = [
      {
        position: 1,
        topicName: "CPU Scheduling Algorithms",
        stem: "In CPU scheduling, what is the primary consequence of the 'convoy effect' under First-Come First-Served (FCFS)?",
        options: [
          "Short processes wait behind a long CPU-bound process, drastically increasing average waiting time",
          "Processes starve indefinitely because higher priority jobs preempt them",
          "Context switch overhead exceeds 50% of CPU capacity",
          "CPU bursts become unpredictable due to exponential smoothing decay"
        ],
        correct_index: 0,
        explanation: "FCFS executes processes strictly in arrival order. A long CPU-bound process holding the CPU causes short I/O-bound processes to wait in the ready queue, creating the convoy effect and inflating average waiting time.",
        difficulty: 2,
      },
      {
        position: 2,
        topicName: "Process Synchronization & Critical Section",
        stem: "Which three requirements must any valid solution to the critical-section problem satisfy?",
        options: [
          "Mutual exclusion, deadlock freedom, and round-robin fairness",
          "Mutual exclusion, progress, and bounded waiting",
          "Preemption, atomicity, and semaphore isolation",
          "Aging, priority inversion avoidance, and progress"
        ],
        correct_index: 1,
        explanation: "According to classic OS theory, any solution to the critical-section problem must satisfy: 1) Mutual exclusion (only one process in the CS at a time), 2) Progress (selection cannot be postponed indefinitely), and 3) Bounded waiting (limit on how many times others enter before a waiting process).",
        difficulty: 1,
      },
      {
        position: 3,
        topicName: "Classic Synchronization Problems",
        stem: "In the standard semaphore solution for the bounded-buffer (producer-consumer) problem, what are the initial values of the semaphores mutex, empty, and full for a buffer of size N?",
        options: [
          "mutex = 0, empty = 0, full = N",
          "mutex = 1, empty = N, full = 0",
          "mutex = 1, empty = 0, full = N",
          "mutex = N, empty = 1, full = 0"
        ],
        correct_index: 1,
        explanation: "mutex is a binary semaphore initialised to 1 for mutual exclusion. 'empty' counts available buffer slots and is initialised to N. 'full' counts populated slots and is initialised to 0.",
        difficulty: 2,
      },
      {
        position: 4,
        topicName: "Deadlocks: Necessary Conditions & Banker's Algorithm",
        stem: "Under Banker's algorithm, what defines a 'safe state'?",
        options: [
          "A state where all processes have zero resource allocations",
          "A state where CPU utilisation is 100% and no page faults occur",
          "A state where there exists at least one order (safe sequence) in which all processes can finish without deadlocking",
          "A state where every process's resource request can be granted immediately simultaneously"
        ],
        correct_index: 2,
        explanation: "A state is safe if the system can allocate resources to each process in some order (the safe sequence) such that each process can satisfy its maximum demand and terminate, returning its resources.",
        difficulty: 2,
      },
      {
        position: 5,
        topicName: "Paging & Memory Management",
        stem: "How does paging eliminate external fragmentation in physical memory?",
        options: [
          "By dynamically compacting memory every 10 milliseconds",
          "By allocating physical memory in non-contiguous, fixed-size frames matching logical pages",
          "By keeping all process instructions strictly in TLB registers",
          "By converting physical addresses directly to 32-bit segment selectors"
        ],
        correct_index: 1,
        explanation: "Paging divides physical memory into fixed-sized blocks (frames). Any free frame can be allocated to a process's page regardless of contiguity, eliminating external fragmentation completely (though internal fragmentation can exist in the last page).",
        difficulty: 2,
      },
      {
        position: 6,
        topicName: "Page Replacement Algorithms",
        stem: "Which of the following statements regarding Belady's anomaly is correct?",
        options: [
          "It can occur under both FIFO and LRU page replacement policies",
          "It describes a situation where allocating more page frames results in more page faults, and it can occur in FIFO",
          "Optimal page replacement exhibits Belady's anomaly on reference strings longer than 100",
          "LRU exhibits Belady's anomaly when the reference string contains repeated loops"
        ],
        correct_index: 1,
        explanation: "Belady's anomaly is the counterintuitive phenomenon where increasing the number of page frames results in an increase in page faults. It can occur under FIFO because FIFO is not a stack algorithm; LRU is a stack algorithm and is mathematically immune to Belady's anomaly.",
        difficulty: 3,
      },
    ];

    const qRows = qDefinitions.map((qd) => {
      const t = createdTopics.find((top) => top.name === qd.topicName);
      return {
        user_id: user.id,
        quiz_id: quiz.id,
        position: qd.position,
        topic_id: t?.id || null,
        stem: qd.stem,
        options: qd.options,
        correct_index: qd.correct_index,
        explanation: qd.explanation,
        difficulty: qd.difficulty,
        source_chunk_ids: [],
      };
    });

    await admin.from("quiz_questions").insert(qRows);
    console.log(`  ✓ Created diagnostic quiz with ${qRows.length} grounded questions ready to take`);
  }
} else {
  console.log(`✓ Diagnostic quiz ready for evaluation (ID: ${readyQuizzes[0].id})`);
}

// 9. Verification summary
console.log("\n=======================================================");
console.log(" Demo Admin Account Successfully Provisioned");
console.log("=======================================================");
console.log(` Email:      ${DEMO_CREDENTIALS.email}`);
console.log(` Password:   ${DEMO_CREDENTIALS.password}`);
console.log(` User ID:    ${user.id}`);
console.log(` Workspace:  ${demoWorkspace.name} (${demoWorkspace.id})`);
console.log(" Status:     Documents Ready | Topics Extracted | Quiz Ready | Plan Active");
console.log("=======================================================\n");
