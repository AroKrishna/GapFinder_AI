"use client";

import { FlaskConical, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { api } from "@/lib/api-client";

export function OpenSampleButton({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const res = await api<{ workspace_id: string; failures: string[]; topics_error: string | null }>("/api/workspaces/sample");
      if (res.failures.length) toast.warning(`Some sample files couldn't be read: ${res.failures[0]}`);
      if (res.topics_error) toast.warning("The sample is ready, but finding topics failed. You can retry from Topic Gaps.");
      else toast.success("Sample subject ready");
      router.push(`/w/${res.workspace_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't set up the sample");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button variant={variant} onClick={open} disabled={busy} aria-busy={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <FlaskConical />}
        {busy ? "Setting up the sample…" : "Try the sample subject"}
      </Button>
      {busy && <p className="text-xs text-muted" role="status">Reading three sets of notes and finding topics — usually under a minute.</p>}
    </div>
  );
}

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const res = await api<{ workspace_id: string }>("/api/workspaces", {
        body: { name: f.get("name"), subject: f.get("subject"), exam_date: f.get("exam_date") || null, hours_per_day: Number(f.get("hours_per_day")) },
      });
      toast.success("Subject created — now add your material");
      router.push(`/w/${res.workspace_id}/documents`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the subject");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3.5">
      <div>
        <Label htmlFor="ws-name">Subject name</Label>
        <Input id="ws-name" name="name" required maxLength={120} placeholder="e.g. DBMS — Mid exam 2" />
      </div>
      <div>
        <Label htmlFor="ws-subject">Course or details <span className="font-normal text-faint">(optional)</span></Label>
        <Input id="ws-subject" name="subject" maxLength={120} placeholder="e.g. Database Management Systems, Unit 3–5" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ws-exam">Exam date</Label>
          <Input id="ws-exam" name="exam_date" type="date" min={new Date().toISOString().slice(0, 10)} />
        </div>
        <div>
          <Label htmlFor="ws-hours">Study hours / day</Label>
          <Input id="ws-hours" name="hours_per_day" type="number" min={0.5} max={16} step={0.5} defaultValue={2} required />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} Create subject
      </Button>
    </form>
  );
}
