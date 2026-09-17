import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatYen(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(digits)}%`;
}
