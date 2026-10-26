"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function TaskToggle({ taskId, done, label }: { taskId: string; done: boolean; label: string }) {
  const router = useRouter();
  const [value, setValue] = useState(done);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !value;
    setValue(next);
    setBusy(true);
    try {
      await api(`/api/tasks/${taskId}`, { method: "PATCH", body: { done: next } });
      if (next) toast.success("Task completed");
      router.refresh();
    } catch (e) {
      setValue(!next);
      toast.error(e instanceof Error ? e.message : "Couldn't update the task");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={value}
      aria-label={`${label}: mark as ${value ? "incomplete" : "completed"}`}
      onClick={toggle}
      disabled={busy}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer",
        value
          ? "border-[#16845B] bg-[#16845B] text-white"
          : "border-border-strong bg-surface text-transparent hover:border-brand hover:text-brand/30",
      )}
    >
      {busy ? <Loader2 className="size-3 animate-spin text-current" /> : <Check className="size-3.5" strokeWidth={2.5} />}
    </button>
  );
}
