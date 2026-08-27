/**
 * Agency scoping. A super admin sees the whole platform; an agency admin sees
 * only their own agency's records. `undefined` means "no scope" (super admin).
 *
 * Filtered in memory rather than with a Firestore `where()` clause: the transit
 * collections are publicly readable anyway, and `where('agencyId','==',x)`
 * silently drops documents whose agencyId is absent, hiding unowned records
 * from the one screen meant to manage them.
 */

export type AgencyScope = string | undefined;

/** Records owned by one agency. Unowned records are NOT included. */
export function scopeOwned<T extends { agencyId?: string }>(items: T[], scope: AgencyScope): T[] {
  if (!scope) return items;
  return items.filter(i => (i.agencyId ?? '').trim() === scope);
}

/**
 * Records owned by one agency, plus unowned ones. A notification with no
 * agencyId is a platform-wide broadcast and must stay visible to every agency.
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
