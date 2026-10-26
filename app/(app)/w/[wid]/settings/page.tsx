import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/primitives";
import { loadWorkspacePage } from "@/lib/services/pages";
import { DeleteWorkspace, WorkspaceSettingsForm } from "./settings-forms";

export const metadata: Metadata = { title: "Subject settings" };

export default async function SubjectSettings({ params }: PageProps<"/w/[wid]/settings">) {
  const { ws } = await loadWorkspacePage(params);
  return (
    <div className="max-w-2xl">
      <PageHeader
        eyebrow="Settings"
        title="Subject Settings"
        description="Your exam target date and daily available study hours dictate how revision tasks are scheduled in your plan."
      />
      <div className="grid gap-6">
        <Card className="p-5 sm:p-6">
          <WorkspaceSettingsForm ws={ws} />
        </Card>
        <Card className="border-[#FCDADA] bg-surface p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-[#C34848]">Delete this subject</h2>
          <p className="mb-4 mt-1 text-xs text-muted leading-relaxed">
            Permanently removes all uploaded materials, extracted topics, assessment responses, knowledge state classifications, and revision plans. This action cannot be reversed.
          </p>
          <DeleteWorkspace workspaceId={ws.id} name={ws.name} />
        </Card>
      </div>
    </div>
  );
}
