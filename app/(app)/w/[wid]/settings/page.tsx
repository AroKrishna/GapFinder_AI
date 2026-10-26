import type { Metadata } from "next";
import { BrandingSettings } from "@/components/branding-settings";
import { ThemeSelector } from "@/components/theme-selector";
import { Card, PageHeader } from "@/components/ui/primitives";
import { loadWorkspacePage } from "@/lib/services/pages";
import { DeleteWorkspace, WorkspaceSettingsForm } from "./settings-forms";

export const metadata: Metadata = { title: "Subject settings" };

export default async function SubjectSettings({ params }: PageProps<"/w/[wid]/settings">) {
  const { ws } = await loadWorkspacePage(params);
  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Settings"
        title="Subject &amp; Appearance Settings"
        description="Configure exam schedules, daily study pacing, application branding, and visual theme preferences."
      />
      <div className="grid gap-6">
        <Card className="p-5 sm:p-6">
          <WorkspaceSettingsForm ws={ws} />
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-ink">Application Branding</h2>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Customize the application name and logo displayed across the sidebar, dashboard, navigation, and page titles.
            </p>
          </div>
          <BrandingSettings />
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink">Appearance &amp; Theme</h2>
          <p className="mb-4 mt-1 text-xs text-muted leading-relaxed">
            Choose your preferred color theme. Light Mode is active by default. You can switch to Dark Mode or synchronize with your operating system.
          </p>
          <ThemeSelector />
        </Card>

        <Card className="border-weak/30 bg-surface p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-weak">Delete this subject</h2>
          <p className="mb-4 mt-1 text-xs text-muted leading-relaxed">
            Permanently removes all uploaded materials, extracted topics, assessment responses, knowledge state classifications, and revision plans. This action cannot be reversed.
          </p>
          <DeleteWorkspace workspaceId={ws.id} name={ws.name} />
        </Card>
      </div>
    </div>
  );
}
