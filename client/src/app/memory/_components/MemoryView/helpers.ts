import { STALE_DAYS } from "./constants";

/** Whole days since an ISO timestamp (null → null). */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function isStale(updatedAt: string): boolean {
  return (daysSince(updatedAt) ?? 0) > STALE_DAYS;
}
