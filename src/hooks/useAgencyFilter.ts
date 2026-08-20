import { useAuth } from '@/hooks/useAuth';
import type { AgencyScope } from '@/lib/scope';

export interface AgencyFilter {
  /** The agency to restrict to, or undefined for a super admin. */
  scopeAgencyId: AgencyScope;
  /**
   * Cache key fragment. Every scoped query MUST include this, or React Query
   * serves one account's cached rows to the next account signed in on the same
   * browser — the scope would be right on the wire and wrong on screen.
   */
  scopeKey: string;
  isScoped: boolean;
}

/**
 * Who the current admin is allowed to see. The single place that decision is
 * made, so a screen cannot accidentally invent its own rule.
 */
export function useAgencyFilter(): AgencyFilter {
  const { user } = useAuth();
  const scopeAgencyId =
    user?.role === 'agency_admin' && user.agencyId ? user.agencyId : undefined;
  return {
    scopeAgencyId,
    scopeKey: scopeAgencyId ?? 'all',
    isScoped: !!scopeAgencyId,
  };
}
