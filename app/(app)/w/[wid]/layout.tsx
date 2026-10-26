import { ArrowLeftRight, CalendarDays, Settings2 } from "lucide-react";
import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { SampleBadge } from "@/components/badges";
import { Logo, LogoMark } from "@/components/logo";
import { loadWorkspacePage } from "@/lib/services/pages";
import { getDisplayName } from "@/lib/services/profile";
import { examCountdown } from "@/lib/utils";
import { MobileTabBar, SidebarNav } from "./workspace-nav";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/w/[wid]">) {
  const { ws, supabase, userId } = await loadWorkspacePage(params);
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims?.email as string | undefined) ?? null;
  const name = await getDisplayName(supabase, userId, email);

  return (
    <div className="flex min-h-screen flex-1 bg-bg">
      {/* Desktop sidebar: 250px wide, solid white surface, clean border */}
      <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 flex-col border-r border-border bg-surface px-4 py-5 lg:flex">
        <Logo href="/workspaces" className="px-1" />

        {/* Current Subject Card */}
        <div className="mt-5 rounded-lg border border-border bg-subtle/50 p-3 shadow-none">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Studying</div>
          <div className="mt-1 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold text-ink" title={ws.name}>{ws.name}</div>
              {ws.subject && <div className="truncate text-xs text-muted" title={ws.subject}>{ws.subject}</div>}
            </div>
            {ws.is_sample && <SampleBadge className="mt-0.5" />}
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1 text-faint">
              <CalendarDays className="size-3.5 text-faint" aria-hidden /> {examCountdown(ws.exam_date)}
            </span>
            <Link href="/workspaces" className="inline-flex items-center gap-1 font-medium text-brand hover:text-brand-hover">
              <ArrowLeftRight className="size-3" aria-hidden /> Switch
            </Link>
          </div>
        </div>

        {/* Main navigation destinations */}
        <div className="mt-5">
          <SidebarNav wid={ws.id} />
        </div>

        {/* Sidebar bottom */}
        <div className="mt-auto space-y-2 pt-4">
          <Link
            href={`/w/${ws.id}/settings`}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-subtle hover:text-ink transition-colors"
          >
            <Settings2 className="size-[17px] text-faint" aria-hidden /> Subject settings
          </Link>
          <div className="border-t border-border pt-3">
            <AccountMenu name={name} email={email} />
          </div>
        </div>
      </aside>

      {/* Main content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
          <Link href="/workspaces" aria-label="All subjects"><LogoMark className="size-7" /></Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{ws.name}</div>
            <div className="truncate text-[11px] text-muted">{examCountdown(ws.exam_date)}</div>
          </div>
          <Link href={`/w/${ws.id}/settings`} className="rounded-lg p-2 text-muted hover:bg-subtle hover:text-ink" aria-label="Subject settings">
            <Settings2 className="size-5" />
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>

      <MobileTabBar wid={ws.id} />
    </div>
  );
}
