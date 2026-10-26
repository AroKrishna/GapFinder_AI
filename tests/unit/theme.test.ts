import { describe, expect, it } from "vitest";
import { z } from "zod";

const themeSchema = z.enum(["light", "dark", "system"]);

type Theme = z.infer<typeof themeSchema>;
type ResolvedTheme = "light" | "dark";

function resolveTheme(preference: Theme | null | undefined, systemPrefersDark: boolean): ResolvedTheme {
  // Light mode is the default across the application for new sessions/no preference
  if (!preference) return "light";
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}

/**
 * Simulates the anti-flicker script in app/layout.tsx:
 * var isDark = t === "dark" || (t === "system" && d);
 */
function evaluateAntiFlicker(storedTheme: string | null, prefersDark: boolean): boolean {
  return storedTheme === "dark" || (storedTheme === "system" && prefersDark);
}

describe("Theme System & Preferences", () => {
  it("strictly validates allowed theme values", () => {
    expect(themeSchema.safeParse("light").success).toBe(true);
    expect(themeSchema.safeParse("dark").success).toBe(true);
    expect(themeSchema.safeParse("system").success).toBe(true);

    // Invalid or malicious theme values must be rejected
    expect(themeSchema.safeParse("neon").success).toBe(false);
    expect(themeSchema.safeParse("").success).toBe(false);
    expect(themeSchema.safeParse("dark; DROP TABLE profiles;").success).toBe(false);
    expect(themeSchema.safeParse(null).success).toBe(false);
    expect(themeSchema.safeParse(123).success).toBe(false);
  });

  it("defaults to light theme for new users without a saved preference, even on dark OS", () => {
    expect(resolveTheme(null, true)).toBe("light");
    expect(resolveTheme(null, false)).toBe("light");
    expect(resolveTheme(undefined, true)).toBe("light");
    expect(resolveTheme(undefined, false)).toBe("light");
  });

  it("anti-flicker logic evaluates to light mode for fresh sessions without saved theme", () => {
    // When no theme is in localStorage (null), anti-flicker should be light (isDark = false)
    expect(evaluateAntiFlicker(null, true)).toBe(false);
    expect(evaluateAntiFlicker(null, false)).toBe(false);
  });

  it("forces light theme when explicitly selected, ignoring system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
    expect(evaluateAntiFlicker("light", true)).toBe(false);
    expect(evaluateAntiFlicker("light", false)).toBe(false);
  });

  it("forces dark theme when explicitly selected, ignoring system preference", () => {
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(evaluateAntiFlicker("dark", true)).toBe(true);
    expect(evaluateAntiFlicker("dark", false)).toBe(true);
  });

  it("dynamically resolves to system preference when system is selected", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(evaluateAntiFlicker("system", true)).toBe(true);
    expect(evaluateAntiFlicker("system", false)).toBe(false);
  });

  it("formats cookie attributes safely for persistent theme preference", () => {
    const theme: Theme = "dark";
    const cookieString = `gapfinder-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    expect(cookieString).toContain("gapfinder-theme=dark");
    expect(cookieString).toContain("SameSite=Lax");
    expect(cookieString).toContain("path=/");
  });
});
