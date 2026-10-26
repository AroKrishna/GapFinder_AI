import type { ReactNode } from "react";
import { requirePageUser } from "@/lib/services/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requirePageUser();
  return <div className="flex min-h-screen flex-1 flex-col bg-bg">{children}</div>;
}
