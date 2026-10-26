"use client";

import {
  AlertCircle,
  Check,
  Eye,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useBranding } from "@/components/branding-provider";
import { GapFinderSymbol } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import {
  DEFAULT_APP_NAME,
  MAX_APP_NAME_LENGTH,
  validateAppName,
  validateLogoFile,
} from "@/lib/branding";
import { cn } from "@/lib/utils";

export function BrandingSettings() {
  const {
    appName,
    logoUrl,
    updateBranding,
    resetBranding,
    isCustom,
    isSaving,
  } = useBranding();

  const [nameInput, setNameInput] = useState(appName);
  const [prevAppName, setPrevAppName] = useState(appName);

  // Sync state if appName updates externally without triggering effect warnings
  if (prevAppName !== appName) {
    setPrevAppName(appName);
    setNameInput(appName);
  }

  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);
  const [removeLogoFlag, setRemoveLogoFlag] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    const val = validateLogoFile(file);
    if (!val.valid) {
      setError(val.error ?? "Invalid image file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setPendingLogoFile(file);
    setRemoveLogoFlag(false);

    // Create local object URL for instant preview
    const previewUrl = URL.createObjectURL(file);
    setPendingLogoPreview(previewUrl);
  }

  // Cancel pending file upload
  function cancelPendingLogo() {
    if (pendingLogoPreview) {
      URL.revokeObjectURL(pendingLogoPreview);
    }
    setPendingLogoFile(null);
    setPendingLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Mark logo for removal
  function handleRemoveLogo() {
    cancelPendingLogo();
    setRemoveLogoFlag(true);
  }

  // Cancel all unsaved changes
  function handleCancel() {
    cancelPendingLogo();
    setRemoveLogoFlag(false);
    setNameInput(appName);
    setError(null);
    setSuccess(null);
  }

  // Save changes
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate application name
    const val = validateAppName(nameInput);
    if (!val.valid) {
      setError(val.error ?? "Invalid application name.");
      return;
    }

    let finalLogoUrl = removeLogoFlag ? null : logoUrl;

    // If there is a pending logo file, upload it first
    if (pendingLogoFile) {
      setUploadingLogo(true);
      try {
        const formData = new FormData();
        formData.append("file", pendingLogoFile);

        const res = await fetch("/api/branding/logo", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || data?.ok === false) {
          throw new Error(data?.error || "Failed to upload logo.");
        }
        finalLogoUrl = data.url;
      } catch (err) {
        setUploadingLogo(false);
        setError(err instanceof Error ? err.message : "Failed to upload logo.");
        return;
      }
      setUploadingLogo(false);
    }

    // Save branding via provider
    const result = await updateBranding({
      appName: val.name,
      logoUrl: finalLogoUrl,
    });

    if (!result.ok) {
      setError(result.error ?? "Failed to save changes.");
    } else {
      cancelPendingLogo();
      setRemoveLogoFlag(false);
      setSuccess("Branding updated successfully! All pages and navigation reflect the changes.");
      toast.success("Application branding updated.");
    }
  }

  // Reset to default branding
  async function handleResetToDefault() {
    cancelPendingLogo();
    setRemoveLogoFlag(false);
    setError(null);
    setSuccess(null);
    setNameInput(DEFAULT_APP_NAME);

    const res = await resetBranding();
    if (res.ok) {
      setSuccess("Application branding reset to GapFinder AI default.");
      toast.success("Branding reset to defaults.");
    }
  }

  // Determine current active preview logo
  const effectiveLogoPreview = removeLogoFlag
    ? null
    : pendingLogoPreview ?? logoUrl;

  const effectiveDisplayName = nameInput.trim() || DEFAULT_APP_NAME;
  const endsWithAi = effectiveDisplayName.endsWith(" AI");
  const mainPart = endsWithAi ? effectiveDisplayName.slice(0, -3).trim() : effectiveDisplayName;

  const hasUnsavedChanges =
    nameInput.trim() !== appName ||
    pendingLogoFile !== null ||
    removeLogoFlag !== false;

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {success && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg border border-strong/30 bg-strong-soft px-4 py-3 text-xs font-medium text-strong"
        >
          <Check className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-lg border border-weak/30 bg-weak-soft px-4 py-3 text-xs font-medium text-weak"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Application Name Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label htmlFor="app-name-input" className="mb-0">
              Application Name
            </Label>
            <span
              className={cn(
                "text-xs",
                nameInput.length > MAX_APP_NAME_LENGTH ? "text-weak font-semibold" : "text-faint",
              )}
            >
              {nameInput.length} / {MAX_APP_NAME_LENGTH}
            </span>
          </div>
          <Input
            id="app-name-input"
            type="text"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setError(null);
            }}
            placeholder={DEFAULT_APP_NAME}
            maxLength={MAX_APP_NAME_LENGTH + 10}
            required
            className="text-base sm:text-sm font-medium"
          />
          <p className="mt-1.5 text-xs text-muted leading-relaxed">
            Displayed in the sidebar, mobile headers, browser tabs, dashboard banners, and authentication screens.
          </p>
        </div>

        {/* Logo Upload Section */}
        <div>
          <Label className="mb-1.5 block">Application Logo</Label>
          <div className="rounded-xl border border-dashed border-border-strong bg-subtle/40 p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="flex items-center gap-3.5">
                {/* Logo Preview Avatar */}
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
                  {effectiveLogoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={effectiveLogoPreview}
                      alt="Logo preview"
                      className="size-full object-contain p-1"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-gradient-to-br from-blue-500 to-brand text-white">
                      <GapFinderSymbol className="size-5" />
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-semibold text-ink">
                    {pendingLogoFile
                      ? `New file: ${pendingLogoFile.name}`
                      : effectiveLogoPreview
                        ? "Custom logo active"
                        : "Default GapFinder AI emblem"}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    PNG, WebP, JPEG, or sanitized SVG up to 2MB.
                  </div>
                </div>
              </div>

              {/* Upload & Clear Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  id="branding-logo-picker"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleFileChange}
                  className="sr-only"
                />

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving || uploadingLogo}
                >
                  <Upload className="size-3.5" />
                  {effectiveLogoPreview ? "Change Logo" : "Upload Logo"}
                </Button>

                {pendingLogoFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelPendingLogo}
                    title="Cancel pending upload"
                    className="text-muted hover:text-ink"
                  >
                    <X className="size-3.5" /> Cancel
                  </Button>
                )}

                {(effectiveLogoPreview || logoUrl) && !pendingLogoFile && !removeLogoFlag && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    title="Revert to default symbol"
                    className="text-weak hover:text-weak hover:bg-weak-soft"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-faint">
              <Eye className="size-3.5" /> Live Preview
            </span>
            <span className="text-[11px] text-muted">
              How your branding appears across the application
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Header / Full Logo Preview */}
            <div className="rounded-lg border border-border bg-subtle/50 p-3.5">
              <div className="text-[11px] font-medium text-muted mb-2">Expanded Header &amp; Sidebar</div>
              <div className="inline-flex items-center gap-2.5 rounded-lg font-display text-[16px] font-semibold tracking-tight text-ink">
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
                  {effectiveLogoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={effectiveLogoPreview} alt="Logo" className="size-full object-contain p-1" />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-gradient-to-br from-blue-500 to-brand text-white">
                      <GapFinderSymbol className="size-4" />
                    </span>
                  )}
                </span>
                <span className="truncate">
                  {endsWithAi ? (
                    <>
                      {mainPart} <span className="font-semibold text-brand">AI</span>
                    </>
                  ) : (
                    effectiveDisplayName
                  )}
                </span>
              </div>
            </div>

            {/* Collapsed Sidebar / Mobile Icon Preview */}
            <div className="rounded-lg border border-border bg-subtle/50 p-3.5">
              <div className="text-[11px] font-medium text-muted mb-2">Collapsed Sidebar / App Icon</div>
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
                  {effectiveLogoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={effectiveLogoPreview} alt="Icon" className="size-full object-contain p-1" />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-gradient-to-br from-blue-500 to-brand text-white">
                      <GapFinderSymbol className="size-4" />
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted">
                  Displays cleanly at small resolutions and mobile bars.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={isSaving || uploadingLogo || !hasUnsavedChanges}
              className="gap-2"
            >
              {isSaving || uploadingLogo ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check className="size-4" /> Save Changes
                </>
              )}
            </Button>

            {hasUnsavedChanges && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                disabled={isSaving || uploadingLogo}
              >
                Cancel
              </Button>
            )}
          </div>

          {isCustom && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetToDefault}
              disabled={isSaving || uploadingLogo}
              className="text-xs text-muted hover:text-ink"
            >
              <RotateCcw className="size-3.5" /> Revert to Default Branding
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
