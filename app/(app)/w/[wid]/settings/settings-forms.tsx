"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { api } from "@/lib/api-client";
import type { Workspace } from "@/lib/services/auth";

export function WorkspaceSettingsForm({ ws }: { ws: Workspace }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await api(`/api/workspaces/${ws.id}`, {
        method: "PATCH",
        body: { name: f.get("name"), subject: f.get("subject"), exam_date: f.get("exam_date") || null, hours_per_day: Number(f.get("hours_per_day")) },
      });
      toast.success("Saved. Update your revision plan to use the new study time.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="s-name">Subject name</Label>
        <Input id="s-name" name="name" defaultValue={ws.name} required maxLength={120} />
      </div>
      <div>
        <Label htmlFor="s-subject">Course or details</Label>
        <Input id="s-subject" name="subject" defaultValue={ws.subject} maxLength={120} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="s-exam">Exam date</Label>
          <Input id="s-exam" name="exam_date" type="date" defaultValue={ws.exam_date ?? ""} />
        </div>
        <div>
          <Label htmlFor="s-hours">Study hours / day</Label>
          <Input id="s-hours" name="hours_per_day" type="number" min={0.5} max={16} step={0.5} defaultValue={ws.hours_per_day} required />
        </div>
      </div>
      <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save changes</Button>
    </form>
  );
}

export function DeleteWorkspace({ workspaceId, name }: { workspaceId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!confirm(`Delete "${name}" and everything in it? This can't be undone.`)) return;
    setBusy(true);
    try {
      await api(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
      toast.success("Subject deleted");
      router.replace("/workspaces");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }
  return (
    <Button variant="danger" onClick={del} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete subject
    </Button>
  );
}
