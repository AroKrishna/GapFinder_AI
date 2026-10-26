"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme, isMounted } = useTheme();

  const toggle = () => {
    // If currently dark, switch to light; if light, switch to dark
    if (resolvedTheme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  const isDark = isMounted ? resolvedTheme === "dark" : false;

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:border-border-strong hover:bg-subtle hover:text-ink transition-colors cursor-pointer",
        className,
      )}
      aria-label={`Switch theme (currently ${theme})`}
      title={`Theme: ${theme}`}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
