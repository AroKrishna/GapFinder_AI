import { ArrowRight, BookOpen, CalendarCheck, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Logo } from "@/components/logo";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";

const STEPS = [
  {
    icon: BookOpen,
    title: "Upload your study materials",
    body: "Upload lecture notes, course syllabi, or textbook chapters in PDF, text, or markdown format. Topics and key concepts are extracted automatically.",
  },
  {
    icon: Target,
    title: "Identify evidence-based gaps",
    body: "Answer quizzes generated strictly from your own materials. The platform analyzes your understanding topic by topic without guessing.",
  },
  {
    icon: CalendarCheck,
    title: "Follow an actionable revision plan",
    body: "Receive a personalized daily study plan calibrated to your upcoming exam date, target score, and daily study hour availability.",
  },
];

export default function Landing() {
  return (
    <div className="relative flex min-h-screen flex-col bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-2" aria-label="Account navigation">
            <LinkButton href="/login" variant="ghost" size="sm">Sign in</LinkButton>
            <LinkButton href="/signup" size="sm">Get started</LinkButton>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            <Sparkles className="size-3.5" aria-hidden /> Evidence-based exam preparation platform
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-3xl font-semibold leading-[1.12] tracking-tight text-ink sm:text-5xl">
            Find your learning gaps. <br className="hidden sm:inline" />
            <span className="text-brand">Focus your revision with evidence.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted">
            GapFinder AI analyzes your college notes and syllabus, identifies exactly which topics require practice through grounded quizzes, and builds an actionable daily study schedule.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton href="/signup" size="lg">
              Get started for free <ArrowRight className="size-4" />
            </LinkButton>
            <LinkButton href="/login" variant="secondary" size="lg">
              Sign in to your account
            </LinkButton>
          </div>
          <p className="mt-4 text-xs text-faint">
            Fast setup: Sign in to explore an interactive Operating Systems sample subject immediately.
          </p>
        </section>

        <section aria-labelledby="how-it-works-heading" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
          <h2 id="how-it-works-heading" className="sr-only">How GapFinder AI Works</h2>
          <ol className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Card className="flex h-full flex-col p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand border border-brand-border">
                      <s.icon className="size-4" aria-hidden />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.06em] text-faint">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-ink">{s.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{s.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <div className="rounded-[var(--radius-card)] border border-brand-border bg-surface p-6 sm:p-8 shadow-[var(--shadow-card)]">
            <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
              <span className="flex size-10 items-center justify-center rounded-lg bg-[#EAF7F0] text-[#16845B] border border-[#C8EED9]">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-base font-semibold text-ink">Academic Credibility by Design</h2>
                <ul className="mt-3 grid gap-4 text-xs leading-relaxed text-muted sm:grid-cols-3">
                  <li>
                    <span className="font-semibold text-ink">Grounded in your material.</span> Every assessment question and AI tutor answer links back to exact page passages in your uploaded notes.
                  </li>
                  <li>
                    <span className="font-semibold text-ink">No unverified classifications.</span> Topics are never classified as weak without direct assessment evidence, and unassessed topics are clearly distinguished.
                  </li>
                  <li>
                    <span className="font-semibold text-ink">Strict privacy &amp; isolation.</span> Your notes, questions, and personal learning records are protected by database row-level security.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface py-6 text-center text-xs text-faint">
        GapFinder AI · Modern Academic Learning Platform
      </footer>
    </div>
  );
}
