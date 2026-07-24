import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '@/components/ui/spinner';

/**
 * Gates access to the authenticated dashboard. Mirrors the mobile app's
 * (admin)/_layout guard: while auth is resolving it shows a loading state; an
 * unauthenticated (or non-admin) user is redirected to /login. Optionally
 * requires the super-admin tier for super-only sections.
 */
export function ProtectedRoute({
  children,
  requireSuperAdmin = false,
}: {
  children: ReactNode;
  requireSuperAdmin?: boolean;
}) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <LoadingState label="Checking access…" />;
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requireSuperAdmin && !user.isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
