import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agenciesService } from '@/services/agencies.service';
import { useAuth } from '@/hooks/useAuth';
import type { Agency } from '@/types';

export interface AgencyScope {
  /** Agencies this admin may actually assign work to. */
  options: Agency[];
  /**
   * True when the admin is locked to a single agency. The form should then show
   * that agency rather than a picker — offering choices the security rules will
   * reject is worse than offering none.
   */
  locked: boolean;
  /** The agency an agency_admin is scoped to, or undefined for a super admin. */
  scopedAgencyId?: string;
  /** Default selection for a new record. */
  defaultAgencyId?: string;
}

/**
 * Agency choices for the current admin.
 *
 * A super admin may assign anything; an agency admin may only ever act inside
 * their own agency, so the picker collapses to that one. This is convenience,
 * not security — firestore.rules reject a cross-agency write regardless of what
 * the client sends.
 */
export function useAgencyScope(enabled = true): AgencyScope {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['agencies'],
    queryFn: () => agenciesService.list(),
    enabled,
  });

  return useMemo(() => {
    const all = data ?? [];
    const scopedAgencyId = user?.role === 'agency_admin' ? user.agencyId : undefined;
    if (!scopedAgencyId) {
      return { options: all, locked: false, scopedAgencyId: undefined, defaultAgencyId: undefined };
    }
    return {
      options: all.filter(a => a.id === scopedAgencyId),
      locked: true,
      scopedAgencyId,
      defaultAgencyId: scopedAgencyId,
    };
  }, [data, user]);
}
