/**
 * Agency scoping.
 *
 * A super admin sees the whole platform. An agency admin sees only their own
 * agency's records, and `undefined` means "no scope" — the super-admin case.
 *
 * Filtering happens here rather than in a Firestore `where()` clause on purpose.
 * The transit collections are publicly readable, because the passenger app needs
 * them without signing in, so a server-side filter would buy no confidentiality —
 * only fewer reads. What it would buy is a failure mode: `where('agencyId','==',x)`
 * silently drops every document whose agencyId is absent or empty, which is
 * exactly how an unowned record disappears from the one screen meant to manage it.
 * Doing it in memory keeps that decision explicit, per collection.
 */

export type AgencyScope = string | undefined;

/** Records owned by one agency. Unowned records are NOT included. */
export function scopeOwned<T extends { agencyId?: string }>(items: T[], scope: AgencyScope): T[] {
  if (!scope) return items;
  return items.filter(i => (i.agencyId ?? '').trim() === scope);
}

/**
 * Records owned by one agency, PLUS unowned ones.
 *
 * For broadcasts: a notification with no agencyId is a platform-wide
 * announcement, and hiding it from the agencies it is addressed to would defeat
 * the point of sending it.
 */
export function scopeOwnedOrGlobal<T extends { agencyId?: string }>(
  items: T[],
  scope: AgencyScope,
): T[] {
  if (!scope) return items;
  return items.filter(i => {
    const owner = (i.agencyId ?? '').trim();
    return !owner || owner === scope;
  });
}

/** Narrows a counts-by-agency map to the scoped agency. */
export function scopeCounts(
  counts: Record<string, number>,
  scope: AgencyScope,
): Record<string, number> {
  if (!scope) return counts;
  return scope in counts ? { [scope]: counts[scope] } : {};
}
