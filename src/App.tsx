import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoginPage } from '@/pages/LoginPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { AgenciesPage } from '@/pages/agencies/AgenciesPage';
import { AgencyDetailPage } from '@/pages/agencies/AgencyDetailPage';
import { AdminsPage } from '@/pages/admins/AdminsPage';
import { RoutesPage } from '@/pages/routes/RoutesPage';
import { StopsPage } from '@/pages/stops/StopsPage';
import { BusesPage } from '@/pages/buses/BusesPage';
import { DriversPage } from '@/pages/drivers/DriversPage';
import { LiveOperationsPage } from '@/pages/live/LiveOperationsPage';
import { SchedulesPage } from '@/pages/schedules/SchedulesPage';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';
import { IssuesPage } from '@/pages/issues/IssuesPage';
import { AnalyticsPage } from '@/pages/analytics/AnalyticsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="agencies" element={<AgenciesPage />} />
        <Route path="agencies/:id" element={<AgencyDetailPage />} />
        <Route
          path="admins"
          element={
            <ProtectedRoute requireSuperAdmin>
              <AdminsPage />
            </ProtectedRoute>
          }
        />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="stops" element={<StopsPage />} />
        <Route path="buses" element={<BusesPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="live" element={<LiveOperationsPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="issues" element={<IssuesPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
