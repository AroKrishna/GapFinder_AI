# Judge guide: a 5-minute walkthrough

## Sign in
- Use the demo account the team gives you, **or** click **Get started** and sign up with any email. Email confirmation is disabled on the demo project.

## 1. Open the sample workspace (~30–60 s)
On **My subjects**, click **Try the sample subject**. This creates a workspace badged **Sample** and uploads three short Operating Systems documents: a syllabus and two sets of notes. It then runs the **real pipeline** on them: text extraction → overlapping chunks with section metadata → Gemini embeddings → pgvector index → topic map. No scores, quizzes or plans are pre-seeded; everything you see afterwards comes from your own actions.

## 2. Inspect the material and topics
- **My Materials:** each file shows *Ready* and its passage count. You can also upload your own PDF or .txt file here.
- **Topic Gaps:** topics extracted from the notes. Click a source chip under "From your material" to see the exact passage a topic is linked to. All topics start as **Not assessed**.

## 3. Take a diagnostic quiz
On Home, click **Start check-in quiz** (or **Take a quick quiz** on Topic Gaps). The app retrieves passages for each topic (hybrid vector + keyword search) and asks Gemini for 4-option MCQs. It then **rejects any question whose evidence quote is not found in a cited passage**; the toast reports how many were rejected. Answer the questions (try getting a few wrong) and submit.

## 4. Review results and explanations
Each question shows your answer, the correct answer, an explanation, the verbatim evidence quote and clickable citations. Scoring is deterministic: a database trigger computes correctness from the stored key. Submitting twice cannot change the score.

## 5. Topic Gaps
**Topic Gaps** groups topics into *Needs practice*, *Developing*, *Not assessed yet* and *Strong*. Each card shows the mastery estimate, the number of questions behind it, an **early estimate** flag when evidence is thin, the reasons, the questions you missed or got right, suggested next actions and sources. Thresholds are listed at the top of the page and are configurable in `lib/core/config.ts`.

## 6. Revision plan
From the results page, click **Make my revision plan**; it opens **Today's Revision**. The plan fits your exam date (10 days away for the sample) and 2 hours/day. Each task shows its activity, duration, priority, a reason and a source passage. Tick a task to complete it.

## 7. Adapt
Take another quiz (for example **Practise this topic** on a "Needs practice" topic), then click **Update plan from latest results** on Today's Revision. The new version keeps your completed tasks and states what changed, e.g. *"Deadlocks: improved from Needs practice to Developing, so it gets less time."*

## 8. Tutor and dashboard
- **Ask AI Tutor:** ask *"Why does FIFO suffer from Belady's anomaly?"* to get a cited answer. Then ask about something not in the notes (e.g. *"Explain B-trees"*) to see the explicit *not enough evidence* response.
- **Home:** a single "Focus next" recommendation, your topic mix and the topics needing attention, today's revision progress, recent materials and the score trend (after 2+ quizzes), all read from saved data.

---

## Manual end-to-end test
Run this on localhost and on the deployed URL after configuring credentials:

| # | Step | Expected |
|---|---|---|
| 1 | Sign up / sign in | Redirected to `/workspaces`; protected pages redirect to `/login` when signed out |
| 2 | Try the sample subject | 3 materials *Ready*, topics with source chips on Topic Gaps |
| 3 | Upload a small PDF | Status goes to *Ready* (or *Needs attention* with a reason and advice; *Retry* works) |
| 4 | Generate quiz | Quiz opens; toast shows question and rejected counts |
| 5 | Submit | Results page with explanations and citations; resubmitting changes nothing |
| 6 | Topic Gaps | States, scores, answer counts, "Why this status?", early-estimate flags |
| 7 | Generate plan | Tasks within hours/day, reasons, sources |
| 8 | Complete a task | Checkbox persists after reload; Home's "Today's revision" count updates |
| 9 | Second quiz → regenerate plan | Version 2, completed tasks kept, change summary present |
| 10 | Second account | Cannot open the first account's `/w/<id>` (404) |
