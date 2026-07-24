import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className combiner (shadcn convention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format an epoch-ms number as a short absolute date-time. */
export function formatDateTime(ms?: number): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format an epoch-ms number as a relative "time ago" label. */
export function formatRelative(ms?: number): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  const diff = Date.now() - ms;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return formatDateTime(ms);
}

/** Compact number formatting for stat tiles (1,234 → 1.2k). */
export function formatCompact(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(n);
}
