import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}`;
}

export function safeJsonParse<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function stripMarkdown(value: string) {
  return value.replace(/[*_#`>-]/g, "").trim();
}
