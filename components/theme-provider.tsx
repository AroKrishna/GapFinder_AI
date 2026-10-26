"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  isMounted: boolean;
}

const STORAGE_KEY = "gapfinder-theme";
const COOKIE_NAME = "gapfinder-theme";
const CHANGE_EVENT = "gapfinder-theme-change";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
    mq.removeEventListener("change", callback);
  };
}

function getSnapshot(): Theme {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === "light" || val === "dark" || val === "system") {
      return val;
    }
  } catch {}
  return "system";
}

function applyDomTheme(theme: Theme, resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
    root.dataset.theme = "dark";
  } else {
    root.classList.remove("dark");
    root.dataset.theme = "light";
  }

  try {
    document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {}
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: ReactNode;
  defaultTheme?: Theme;
}) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => defaultTheme);

  // Compute resolved theme
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === "light") return "light";
    if (theme === "dark") return "dark";
    return getSystemTheme();
  }, [theme]);

  // Synchronize DOM classes whenever theme or system preference changes
  useEffect(() => {
    applyDomTheme(theme, resolvedTheme);
  }, [theme, resolvedTheme]);

  // Sync from server if no preference was set locally
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        fetch("/api/user/preferences")
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.theme && (data.theme === "light" || data.theme === "dark" || data.theme === "system")) {
              localStorage.setItem(STORAGE_KEY, data.theme);
              window.dispatchEvent(new Event(CHANGE_EVENT));
            }
          })
          .catch(() => {});
      }
    } catch {}
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {}

    const resolved = nextTheme === "system" ? getSystemTheme() : nextTheme;
    applyDomTheme(nextTheme, resolved);
    window.dispatchEvent(new Event(CHANGE_EVENT));

    // Save to user preferences API
    fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: nextTheme }),
    }).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, isMounted: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
