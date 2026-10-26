"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";

export default function WorkspaceError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      icon={<AlertTriangle className="text-[#A66A0A]" />}
      title="This section encountered an issue"
      description="Your data is intact and preserved. This is typically a temporary connection or processing interruption."
      action={
        <Button onClick={reset} variant="secondary">
          <RotateCw className="size-4" /> Retry loading
        </Button>
      }
    />
  );
}
