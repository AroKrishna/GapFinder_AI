"use client";

import { Check, Laptop, Moon, Sun } from "lucide-react";
import { type Theme, useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

interface ThemeOption {
  value: Theme;
  label: string;
  description: string;
  icon: typeof Sun;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Light",
    description: "Crisp white academic surface with calm navy text",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Deep charcoal palette with high-contrast readable text",
    icon: Moon,
  },
  {
    value: "system",
    label: "System default",
    description: "Automatically matches your operating system or device settings",
    icon: Laptop,
  },
];

export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme, isMounted } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance theme preference"
      className={cn("grid gap-3 sm:grid-cols-3", className)}
    >
      {THEME_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isSelected = isMounted ? theme === opt.value : opt.value === "light";

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={() => setTheme(opt.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setTheme(opt.value);
              }
            }}
            className={cn(
              "group relative flex flex-col justify-between rounded-[var(--radius-card)] border p-4 text-left transition-[border-color,box-shadow,background] cursor-pointer",
              isSelected
                ? "border-brand bg-brand-soft/30 shadow-[var(--shadow-raised)] ring-2 ring-brand/30"
                : "border-border bg-surface hover:border-border-strong hover:bg-subtle/50",
            )}
          >
            {/* Top row: Icon and check badge */}
            <div className="flex items-center justify-between">
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg transition-colors",
                  isSelected
                    ? "bg-brand text-white"
                    : "bg-subtle text-muted group-hover:text-ink",
                )}
                aria-hidden
              >
                <Icon className="size-4" />
              </div>
              {isSelected && (
                <span
                  className="flex size-5 items-center justify-center rounded-full bg-brand text-white shadow-xs"
                  aria-hidden
                >
                  <Check className="size-3 stroke-[3]" />
                </span>
              )}
            </div>

            {/* Label and description */}
            <div className="mt-3.5">
              <div className="flex items-center gap-1.5 font-semibold text-sm text-ink">
                {opt.label}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {opt.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
