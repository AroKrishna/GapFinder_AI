export const DEFAULT_APP_NAME = "GapFinder AI";
export const DEFAULT_APP_DESCRIPTION = "Find your gaps. Focus your learning. Improve with evidence.";

export const BRANDING_STORAGE_KEY = "gapfinder-branding";
export const BRANDING_COOKIE_NAME = "gapfinder-branding";
export const BRANDING_CHANGE_EVENT = "gapfinder-branding-change";

export interface BrandingConfig {
  appName: string;
  logoUrl: string | null;
}

export const MAX_APP_NAME_LENGTH = 60;
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];

export function validateAppName(rawName: unknown): { valid: boolean; error?: string; name: string } {
  if (typeof rawName !== "string") {
    return { valid: false, error: "Application name must be text.", name: "" };
  }
  const name = rawName.trim();
  if (name.length === 0) {
    return { valid: false, error: "Application name cannot be empty.", name: "" };
  }
  if (name.length > MAX_APP_NAME_LENGTH) {
    return {
      valid: false,
      error: `Application name must be ${MAX_APP_NAME_LENGTH} characters or less.`,
      name,
    };
  }
  return { valid: true, name };
}

export function validateLogoFile(file: { name: string; size: number; type: string }): {
  valid: boolean;
  error?: string;
} {
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 2MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller image.`,
    };
  }

  const mime = file.type.toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase();
  const validExts = ["png", "jpg", "jpeg", "webp", "svg"];

  if (!ALLOWED_LOGO_TYPES.includes(mime) && (!ext || !validExts.includes(ext))) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload a PNG, WebP, JPEG, or SVG image.",
    };
  }

  return { valid: true };
}

/**
 * Basic server/client SVG sanitizer removing executable script tags and inline event handlers.
 */
export function sanitizeSvg(rawSvg: string): string {
  return rawSvg
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, "");
}
