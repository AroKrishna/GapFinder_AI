"use client";

import { Check, Copy, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { DEMO_CREDENTIALS } from "@/lib/core/demo";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<"email" | "password" | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name }, emailRedirectTo: `${location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Check your inbox to confirm your email, then sign in.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/workspaces");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  function copyCredential(key: "email" | "password", value: string) {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  }

  function handleAutoFill() {
    setEmail(DEMO_CREDENTIALS.email);
    setPassword(DEMO_CREDENTIALS.password);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "signup" && (
        <div>
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Chen" autoComplete="name" />
        </div>
      )}
      <div>
        <Label htmlFor="email">Email Address</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@college.edu" autoComplete="email" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition hover:text-foreground focus:outline-hidden"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-[#FCDADA] bg-[#FFF0F0] px-3 py-2 text-xs font-medium text-[#C34848]">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-md border border-[#C8EED9] bg-[#EAF7F0] px-3 py-2 text-xs font-medium text-[#16845B]">
          {notice}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        {mode === "signup" ? "Create Account" : "Sign In"}
      </Button>

      {mode === "login" && (
        <div className="mt-5 rounded-lg border border-brand-border/90 bg-brand-soft/40 p-3.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-brand-border/60">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-brand" />
              Demo Admin Access
            </span>
            <button
              type="button"
              onClick={handleAutoFill}
              className="font-medium text-brand hover:text-brand-hover hover:underline cursor-pointer"
            >
              Fill credentials
            </button>
          </div>

          <div className="mt-2.5 space-y-2">
            <div className="flex items-center justify-between rounded bg-surface/80 px-2.5 py-1.5 border border-border/60">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-muted font-medium shrink-0">Email:</span>
                <span className="font-mono text-foreground select-all truncate text-[11px] sm:text-xs">{DEMO_CREDENTIALS.email}</span>
              </div>
              <button
                type="button"
                onClick={() => copyCredential("email", DEMO_CREDENTIALS.email)}
                aria-label="Copy demo email"
                className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted hover:text-foreground shrink-0 cursor-pointer"
              >
                {copiedKey === "email" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <Check className="size-3" /> Copied
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Copy className="size-3" /> Copy
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between rounded bg-surface/80 px-2.5 py-1.5 border border-border/60">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-muted font-medium shrink-0">Password:</span>
                <span className="font-mono text-foreground select-all truncate text-[11px] sm:text-xs">{DEMO_CREDENTIALS.password}</span>
              </div>
              <button
                type="button"
                onClick={() => copyCredential("password", DEMO_CREDENTIALS.password)}
                aria-label="Copy demo password"
                className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted hover:text-foreground shrink-0 cursor-pointer"
              >
                {copiedKey === "password" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <Check className="size-3" /> Copied
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Copy className="size-3" /> Copy
                  </span>
                )}
              </button>
            </div>
          </div>

          <p className="mt-2.5 text-[11px] leading-relaxed text-muted">
            Shared demo account for evaluators. Do not store personal information here.
          </p>
        </div>
      )}

      <p className="text-center text-xs text-muted">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link className="font-semibold text-brand hover:text-brand-hover" href="/login">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to GapFinder AI?{" "}
            <Link className="font-semibold text-brand hover:text-brand-hover" href="/signup">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
