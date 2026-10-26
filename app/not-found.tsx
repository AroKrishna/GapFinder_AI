import { LogoMark } from "@/components/logo";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[70vh] flex-1 flex-col items-center justify-center bg-bg px-4 text-center">
      <div className="flex flex-col items-center max-w-md rounded-[var(--radius-card)] border border-border bg-surface p-8 shadow-[var(--shadow-card)]">
        <LogoMark className="size-10" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.06em] text-brand">404 Error · Page not found</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          The requested page may have been moved, removed, or belongs to a different subject workspace.
        </p>
        <LinkButton href="/workspaces" className="mt-6">Return to My Subjects</LinkButton>
      </div>
    </div>
  );
}
