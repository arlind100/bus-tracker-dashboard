import { useAuth } from '@/hooks/useAuth';
import type { AgencyScope } from '@/lib/scope';

export interface AgencyFilter {
  /** The agency to restrict to, or undefined for a super admin. */
  scopeAgencyId: AgencyScope;
  /**
   * Cache key fragment. Every scoped query MUST include this, or React Query
   * serves one account's cached rows to the next account in the same browser.
   */
  scopeKey: string;
  isScoped: boolean;
}

/** The single place the "what may this admin see" decision is made. */
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
