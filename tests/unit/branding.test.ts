import { describe, expect, it } from "vitest";
import {
  DEFAULT_APP_NAME,
  MAX_APP_NAME_LENGTH,
  MAX_LOGO_SIZE_BYTES,
  sanitizeSvg,
  validateAppName,
  validateLogoFile,
} from "@/lib/branding";

describe("Application Branding & Validation", () => {
  describe("Application Name Validation", () => {
    it("accepts valid application names and trims whitespace", () => {
      const res1 = validateAppName("GapFinder AI");
      expect(res1.valid).toBe(true);
      expect(res1.name).toBe("GapFinder AI");

      const res2 = validateAppName("   Acme Learning Academy   ");
      expect(res2.valid).toBe(true);
      expect(res2.name).toBe("Acme Learning Academy");

      const res3 = validateAppName("StudyHub 2.0");
      expect(res3.valid).toBe(true);
      expect(res3.name).toBe("StudyHub 2.0");
    });

    it("rejects empty or whitespace-only names", () => {
      expect(validateAppName("").valid).toBe(false);
      expect(validateAppName("   ").valid).toBe(false);
      expect(validateAppName("\t\n").valid).toBe(false);
      expect(validateAppName(null).valid).toBe(false);
      expect(validateAppName(undefined).valid).toBe(false);
    });

    it("rejects application names exceeding maximum allowed length", () => {
      const longName = "A".repeat(MAX_APP_NAME_LENGTH + 1);
      const res = validateAppName(longName);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("60 characters or less");

      const exactMaxLengthName = "A".repeat(MAX_APP_NAME_LENGTH);
      expect(validateAppName(exactMaxLengthName).valid).toBe(true);
    });

    it("provides the canonical default application name", () => {
      expect(DEFAULT_APP_NAME).toBe("GapFinder AI");
    });
  });

  describe("Logo File Validation", () => {
    it("accepts supported logo formats under 2MB", () => {
      expect(validateLogoFile({ name: "logo.png", size: 1024 * 500, type: "image/png" }).valid).toBe(true);
      expect(validateLogoFile({ name: "logo.webp", size: 1024 * 200, type: "image/webp" }).valid).toBe(true);
      expect(validateLogoFile({ name: "logo.jpg", size: 1024 * 800, type: "image/jpeg" }).valid).toBe(true);
      expect(validateLogoFile({ name: "logo.svg", size: 1024 * 50, type: "image/svg+xml" }).valid).toBe(true);
    });

    it("rejects files exceeding 2MB limit", () => {
      const oversized = validateLogoFile({
        name: "huge.png",
        size: MAX_LOGO_SIZE_BYTES + 1024,
        type: "image/png",
      });
      expect(oversized.valid).toBe(false);
      expect(oversized.error).toContain("exceeds the 2MB limit");
    });

    it("rejects unsupported file formats", () => {
      expect(validateLogoFile({ name: "app.exe", size: 1024, type: "application/x-msdownload" }).valid).toBe(false);
      expect(validateLogoFile({ name: "script.js", size: 1024, type: "application/javascript" }).valid).toBe(false);
      expect(validateLogoFile({ name: "doc.pdf", size: 1024, type: "application/pdf" }).valid).toBe(false);
      expect(validateLogoFile({ name: "archive.zip", size: 1024, type: "application/zip" }).valid).toBe(false);
    });
  });

  describe("SVG Sanitization", () => {
    it("strips malicious script tags from uploaded SVGs", () => {
      const malicious = `<svg><script>alert("pwned")</script><circle cx="5" cy="5" r="4" /></svg>`;
      const cleaned = sanitizeSvg(malicious);
      expect(cleaned).not.toContain("<script>");
      expect(cleaned).not.toContain('alert("pwned")');
      expect(cleaned).toContain('<circle cx="5" cy="5" r="4" />');
    });

    it("strips inline event handlers such as onload and onerror", () => {
      const malicious = `<svg onload="alert(1)"><circle cx="5" cy="5" r="4" onerror="bad()" /></svg>`;
      const cleaned = sanitizeSvg(malicious);
      expect(cleaned).not.toContain("onload=");
      expect(cleaned).not.toContain("onerror=");
    });

    it("strips foreignObject tags", () => {
      const malicious = `<svg><foreignObject><div>bad</div></foreignObject><rect width="10" height="10" /></svg>`;
      const cleaned = sanitizeSvg(malicious);
      expect(cleaned).not.toContain("foreignObject");
      expect(cleaned).toContain('<rect width="10" height="10" />');
    });

    it("preserves valid SVG vector elements and paths", () => {
      const clean = `<svg viewBox="0 0 24 24"><path d="M 0 0 L 10 10" stroke="#315FE8" /></svg>`;
      const result = sanitizeSvg(clean);
      expect(result).toBe(clean);
    });
  });
});
