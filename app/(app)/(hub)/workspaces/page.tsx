import { ArrowRight, BookOpen, CalendarDays, Clock, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SampleBadge } from "@/components/badges";
import { BrandName } from "@/components/brand-name";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requirePageUser } from "@/lib/services/auth";
import { getDisplayName } from "@/lib/services/profile";
import { examCountdown } from "@/lib/utils";
import { CreateWorkspaceForm, OpenSampleButton } from "./workspace-actions";

export const metadata: Metadata = { title: "My subjects" };

interface Row {
  id: string;
  name: string;
  subject: string;
  exam_date: string | null;
  hours_per_day: number;
  is_sample: boolean;
  documents: { count: number }[];
  topics: { count: number }[];
}

export default async function SubjectsPage() {
  const { supabase, userId, email } = await requirePageUser();
  const [name, { data }] = await Promise.all([
    getDisplayName(supabase, userId, email),
    supabase
      .from("workspaces")
      .select("id, name, subject, exam_date, hours_per_day, is_sample, created_at, documents(count), topics(count)")
      .order("created_at", { ascending: false }),
  ]);
  const list = (data ?? []) as unknown as Row[];

  if (list.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow={`Welcome, ${name.split(" ")[0]}`}
          title="Select or create a subject to begin"
          description={<><BrandName /> tracks your knowledge gaps and prepares custom revision plans for each of your courses or exam targets.</>}
        />
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col rounded-[var(--radius-card)] border border-brand-border bg-brand-soft/50 p-6 shadow-sm">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand border border-brand-border">
              <FlaskConical className="size-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-ink">Explore the Sample Subject</h2>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted">
              Experience the complete student journey on curated Operating Systems study materials: topic gaps, interactive check-in quizzes, and a personalized revision schedule.
            </p>
            <div className="mt-5">
              <OpenSampleButton variant="primary" />
            </div>
          </div>

          <Card className="p-6">
            <div className="flex size-10 items-center justify-center rounded-lg bg-subtle text-muted">
              <BookOpen className="size-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-ink">Create Your First Subject</h2>
            <p className="mb-4 mt-1 text-xs text-muted">Provide your exam date and study hours to initialize a workspace.</p>
            <CreateWorkspaceForm />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={`Welcome, ${name.split(" ")[0]}`}
        title="My Subjects"
        description="Each subject workspace keeps its own study materials, topic gap classifications, and personalized revision schedule."
        actions={<OpenSampleButton />}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section aria-label="Subjects" className="grid content-start gap-4 sm:grid-cols-2">
          {list.map((w) => (
            <Link key={w.id} href={`/w/${w.id}`} className="group block rounded-[var(--radius-card)]">
              <Card interactive className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand border border-brand-border">
                    <BookOpen className="size-4" />
                  </div>
                  {w.is_sample && <SampleBadge />}
                </div>
                <h2 className="mt-3 text-sm font-semibold text-ink leading-snug">{w.name}</h2>
                {w.subject && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{w.subject}</p>}
                <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5 text-faint" aria-hidden /> {examCountdown(w.exam_date)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5 text-faint" aria-hidden /> {Number(w.hours_per_day)} h/day
                  </span>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted" style={{ marginTop: "1rem" }}>
                  <span>{w.documents[0]?.count ?? 0} materials · {w.topics[0]?.count ?? 0} topics</span>
                  <span className="inline-flex items-center gap-1 font-medium text-brand group-hover:text-brand-hover">
                    Open subject <ArrowRight className="size-3" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </section>

        <aside>
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Add a New Subject</h2>
            <p className="mb-4 mt-0.5 text-xs text-muted">Configure the subject and target exam parameters.</p>
            <CreateWorkspaceForm />
          </Card>
        </aside>
      </div>
    </>
  );
}
