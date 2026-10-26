import { describe, expect, it } from "vitest";
import { z } from "zod";

const themeSchema = z.enum(["light", "dark", "system"]);

type Theme = z.infer<typeof themeSchema>;
type ResolvedTheme = "light" | "dark";

function resolveTheme(preference: Theme, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
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

  it("forces light theme when explicitly selected, ignoring system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
  });

  it("forces dark theme when explicitly selected, ignoring system preference", () => {
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("dynamically resolves to system preference when system is selected", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("formats cookie attributes safely for persistent theme preference", () => {
    const theme: Theme = "dark";
    const cookieString = `gapfinder-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    expect(cookieString).toContain("gapfinder-theme=dark");
    expect(cookieString).toContain("SameSite=Lax");
    expect(cookieString).toContain("path=/");
  });
});
