import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const pct = (x: number | null | undefined) => `${Math.round(Number(x ?? 0) * 100)}%`;

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso).toLocaleDateString("en-IN", { timeZone: "UTC", ...opts });
}

/** Whole days from today (UTC) to an ISO date; negative if past. */
export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((Date.parse(isoDate) - Date.parse(today)) / 86_400_000);
}

export function examCountdown(isoDate: string | null | undefined): string {
  const d = daysUntil(isoDate);
  if (d === null) return "No exam date set";
  if (d < 0) return `Exam was ${formatDate(isoDate)}`;
  if (d === 0) return "Exam today";
  if (d === 1) return "Exam tomorrow";
  return `Exam in ${d} days`;
}

export function greeting(date = new Date()): string {
  // India Standard Time (UTC+5:30) — the app's primary audience.
  const h = (date.getUTCHours() + 5 + Math.floor((date.getUTCMinutes() + 30) / 60)) % 24;
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function minutesLabel(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}
