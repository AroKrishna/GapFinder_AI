import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted hover:text-ink">
      <ArrowLeft className="size-4" aria-hidden /> {children}
    </Link>
  );
}
