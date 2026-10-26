"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  BRANDING_CHANGE_EVENT,
  BRANDING_COOKIE_NAME,
  BRANDING_STORAGE_KEY,
  DEFAULT_APP_NAME,
  type BrandingConfig,
} from "@/lib/branding";

export interface BrandingContextValue {
  appName: string;
  logoUrl: string | null;
  isCustom: boolean;
  isLoading: boolean;
  isSaving: boolean;
  updateBranding: (updates: { appName?: string; logoUrl?: string | null }) => Promise<{ ok: boolean; error?: string }>;
  resetBranding: () => Promise<{ ok: boolean }>;
  isMounted: boolean;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

const DEFAULT_CONFIG: BrandingConfig = {
  appName: DEFAULT_APP_NAME,
  logoUrl: null,
};

let cachedSnapshot: BrandingConfig = DEFAULT_CONFIG;
let cachedRaw: string | null = null;

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(BRANDING_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(BRANDING_CHANGE_EVENT, callback);
  };
}

function getSnapshot(): BrandingConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (raw === cachedRaw && cachedSnapshot) {
      return cachedSnapshot;
    }
    cachedRaw = raw;
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedSnapshot = {
        appName: typeof parsed.appName === "string" && parsed.appName.trim() ? parsed.appName.trim() : DEFAULT_APP_NAME,
        logoUrl: typeof parsed.logoUrl === "string" ? parsed.logoUrl : null,
      };
      return cachedSnapshot;
    }
  } catch {}
  cachedSnapshot = DEFAULT_CONFIG;
  return cachedSnapshot;
}

function persistLocalSnapshot(config: BrandingConfig) {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(config);
    localStorage.setItem(BRANDING_STORAGE_KEY, serialized);
    document.cookie = `${BRANDING_COOKIE_NAME}=${encodeURIComponent(serialized)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {}
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const branding = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Sync from server API once on mount
  useEffect(() => {
    fetch("/api/branding")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.app_name) {
          const synced: BrandingConfig = {
            appName: data.app_name,
            logoUrl: data.logo_url ?? null,
          };
          persistLocalSnapshot(synced);
          window.dispatchEvent(new Event(BRANDING_CHANGE_EVENT));
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Synchronize document title with dynamic application name
  useEffect(() => {
    if (typeof document === "undefined") return;
    const currentTitle = document.title;
    if (currentTitle && currentTitle.includes("GapFinder AI") && branding.appName !== "GapFinder AI") {
      document.title = currentTitle.replaceAll("GapFinder AI", branding.appName);
    }
  }, [branding.appName]);

  const updateBranding = useCallback(
    async (updates: { appName?: string; logoUrl?: string | null }) => {
      setIsSaving(true);
      try {
        const nextConfig: BrandingConfig = {
          appName: updates.appName !== undefined ? updates.appName.trim() || DEFAULT_APP_NAME : branding.appName,
          logoUrl: updates.logoUrl !== undefined ? updates.logoUrl : branding.logoUrl,
        };

        // Optimistically persist and notify subscribers
        persistLocalSnapshot(nextConfig);
        window.dispatchEvent(new Event(BRANDING_CHANGE_EVENT));

        const res = await fetch("/api/branding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        const data = await res.json();
        if (!res.ok || data?.ok === false) {
          return { ok: false, error: data?.error || "Failed to save branding." };
        }

        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Failed to save branding." };
      } finally {
        setIsSaving(false);
      }
    },
    [branding],
  );

  const resetBranding = useCallback(async () => {
    setIsSaving(true);
    try {
      const resetConfig: BrandingConfig = {
        appName: DEFAULT_APP_NAME,
        logoUrl: null,
      };
      persistLocalSnapshot(resetConfig);
      window.dispatchEvent(new Event(BRANDING_CHANGE_EVENT));

      await fetch("/api/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName: DEFAULT_APP_NAME, logoUrl: null }),
      });

      return { ok: true };
    } catch {
      return { ok: false };
    } finally {
      setIsSaving(false);
    }
  }, []);

  const isCustom = branding.appName !== DEFAULT_APP_NAME || Boolean(branding.logoUrl);

  return (
    <BrandingContext.Provider
      value={{
        appName: branding.appName,
        logoUrl: branding.logoUrl,
        isCustom,
        isLoading,
        isSaving,
        updateBranding,
        resetBranding,
        isMounted: true,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const context = useContext(BrandingContext);
  if (!context) {
    return {
      appName: DEFAULT_APP_NAME,
      logoUrl: null,
      isCustom: false,
      isLoading: false,
      isSaving: false,
      updateBranding: async () => ({ ok: true }),
      resetBranding: async () => ({ ok: true }),
      isMounted: false,
    };
  }
  return context;
}
