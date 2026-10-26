import { Logo } from "@/components/logo";
import { isSupabaseConfigured } from "@/lib/env";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12">
      <div className="flex w-full flex-col items-center">
        <Logo className="mb-6" />
        <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-border bg-surface p-6 sm:p-7 shadow-[var(--shadow-card)]">
          {!isSupabaseConfigured() && (
            <div className="mb-4 rounded-md border border-[#FCE8BD] bg-[#FFF5DE] px-3 py-2 text-xs text-[#A66A0A]">
              Authentication is not configured on this environment (refer to <code>.env.example</code>).
            </div>
          )}
          {children}
        </div>
        <p className="mt-6 max-w-sm text-center text-xs leading-relaxed text-faint">
          Sign up with any email address, then select <span className="font-medium text-muted">Try the sample subject</span> to test the platform.
        </p>
      </div>
    </div>
  );
}
