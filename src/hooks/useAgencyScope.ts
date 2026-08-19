import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agenciesService } from '@/services/agencies.service';
import { useAuth } from '@/hooks/useAuth';
import type { Agency } from '@/types';

export interface AgencyScope {
  options: Agency[];
  locked: boolean;
  scopedAgencyId?: string;
  defaultAgencyId?: string;
}

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
