"use client";

import { AlertCircle, Check, Loader2, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, Input } from "@/components/ui/primitives";

export const PROFILE_CHANGE_EVENT = "gapfinder-profile-change";
const MAX_LENGTH = 100;

interface AccountProfileCardProps {
  initialName: string;
  email: string | null;
}

export function AccountProfileCard({ initialName, email }: AccountProfileCardProps) {
  const router = useRouter();
  const [currentName, setCurrentName] = useState(initialName);
  const [prevInitialName, setPrevInitialName] = useState(initialName);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Sync state if initialName updates from server revalidation
  if (prevInitialName !== initialName) {
    setPrevInitialName(initialName);
    setCurrentName(initialName);
    if (!isEditing) {
      setNameInput(initialName);
    }
  }

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  function handleStartEdit() {
    setNameInput(currentName);
    setError(null);
    setSuccess(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setNameInput(currentName);
    setError(null);
    setIsEditing(false);
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isSaving) return;

    const trimmed = nameInput.trim();
    if (!trimmed) {
      setError("Full name cannot be empty.");
      inputRef.current?.focus();
      return;
    }

    if (trimmed.length > MAX_LENGTH) {
      setError(`Full name cannot exceed ${MAX_LENGTH} characters.`);
      return;
    }

    if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
      setError("Name contains invalid characters.");
      return;
    }

    // If unchanged, simply exit edit mode
    if (trimmed === currentName) {
      setIsEditing(false);
      setError(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Failed to update profile name.");
      }

      const updatedName = data.name || trimmed;
      setCurrentName(updatedName);
      setNameInput(updatedName);
      setIsEditing(false);
      setSuccess("Profile name updated successfully.");
      toast.success("Profile name updated.");

      // Broadcast event so UI (like sidebar account menu) updates instantaneously
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(PROFILE_CHANGE_EVENT, { detail: { name: updatedName } }),
        );
      }

      // Re-run server components so page headers and greetings synchronize
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update full name.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  }

  return (
    <Card className="divide-y divide-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-ink">Account Profile</h2>
          <p className="mt-0.5 text-xs text-muted">
            Your personal identity used across revision plans, quizzes, and tutor interactions.
          </p>
        </div>
        {!isEditing && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleStartEdit}
            className="text-xs"
          >
            <Pencil className="size-3.5" /> Edit Profile
          </Button>
        )}
      </div>

      {/* Status Alerts */}
      {success && (
        <div
          role="status"
          className="flex items-center justify-between gap-2.5 bg-strong-soft px-4 py-2.5 text-xs font-medium text-strong sm:px-5"
        >
          <div className="flex items-center gap-2">
            <Check className="size-4 shrink-0" />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="text-strong/70 hover:text-strong cursor-pointer"
            aria-label="Dismiss message"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2.5 bg-weak-soft px-4 py-2.5 text-xs font-medium text-weak sm:px-5"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-weak/70 hover:text-weak cursor-pointer"
            aria-label="Dismiss error"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Full Name Row */}
      <div className="p-4 sm:px-5">
        <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
          <label htmlFor="profile-full-name-input" className="text-xs font-semibold text-muted">
            Full Name
          </label>

          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    ref={inputRef}
                    id="profile-full-name-input"
                    type="text"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isSaving}
                    maxLength={MAX_LENGTH}
                    placeholder="Enter your full name"
                    className="h-9 text-xs sm:text-sm font-medium pr-14"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-faint">
                    {nameInput.length}/{MAX_LENGTH}
                  </span>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving || !nameInput.trim()}
                  className="h-9 px-3 text-xs"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" /> Save
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="h-9 px-2.5 text-xs text-muted hover:text-ink"
                >
                  Cancel
                </Button>
              </div>
              <p className="text-[11px] text-muted">
                Press <kbd className="rounded bg-subtle px-1 py-0.5 text-[10px] text-ink font-mono border border-border">Enter</kbd> to save or <kbd className="rounded bg-subtle px-1 py-0.5 text-[10px] text-ink font-mono border border-border">Esc</kbd> to cancel.
              </p>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-ink font-medium sm:text-sm">{currentName}</div>
              <button
                type="button"
                onClick={handleStartEdit}
                className="text-xs text-brand hover:text-brand-hover hover:underline cursor-pointer font-medium"
              >
                Change
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Email Address Row (Read-only) */}
      <div className="p-4 sm:px-5">
        <div className="grid gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
          <div className="text-xs font-semibold text-muted">Email Address</div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-ink font-medium sm:text-sm">{email ?? "—"}</div>
            <span className="rounded-md border border-border bg-subtle/50 px-2 py-0.5 text-[10px] font-medium text-faint">
              Primary Account Login
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
