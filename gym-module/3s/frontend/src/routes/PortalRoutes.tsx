import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PortalNotFound from '../components/PortalNotFound';
import FeatureRoute from '../components/FeatureRoute';
import { GYM_DASHBOARD_VISIBLE } from '../config/portalNavigation';
import PtManagementView from '../components/admin/PtManagementView';
import PackageTemplateView from '../components/admin/PackageTemplateView';

// Pages
import InBodyPage from '../pages/pt/InBodyPage';
import PtCustomersPage from '../pages/pt/PtCustomersPage';
import PtDashboardPage from '../pages/pt/PtDashboardPage';
import RoadmapPage from '../pages/pt/RoadmapPage';
import MyWorkoutPlans from '../components/workouts/MyWorkoutPlans';
import WorkoutStudioPage from '../pages/pt/WorkoutStudioPage';
import ProgressPage from '../pages/pt/ProgressPage';
import NutritionPage from '../pages/pt/NutritionPage';
import PtAssistantPage from '../pages/pt/PtAssistantPage';
import AdminCustomersPage from '../pages/admin/AdminCustomersPage';
import AdminTransfersPage from '../pages/admin/AdminTransfersPage';
import AdminUsersPage from '../pages/admin/AdminUsersPage';
import AdminAccountsPage from '../pages/admin/AdminAccountsPage';
import AdminKnowledgePage from '../pages/admin/AdminKnowledgePage';
import CustomerPortalPage from '../pages/customer/CustomerPortalPage';
import NotificationsPage from '../pages/common/NotificationsPage';
import ConsultationTool from '../pages/ConsultationTool';
import WalletPage from '../pages/common/ErpWalletPage';

import { getSession, saveSession } from '../services/session';
import { api } from '../services/api';
import type { Session, User } from '../types';
import { CreditWalletProvider } from '../contexts/CreditWalletContext';

const roleDestinations = {
  SUPER_ADMIN: '/admin/admin-accounts',
  ADMIN: '/customers',
  PT: '/customers',
  CUSTOMER: '/me',
} as const;
const roleLabels = { SUPER_ADMIN: 'quản trị cấp cao', ADMIN: 'ADMIN', PT: 'PT', CUSTOMER: 'khách hàng' } as const;

function PortalContent({ user }: { user: User }) {
  const location = useLocation();
  const isPortalRoot = location.pathname === '/portal' || location.pathname === '/portal/' || location.pathname === '/';
  const legacyAdminTab = new URLSearchParams(location.search).get('tab');
  const legacyAdminPath = legacyAdminTab === 'packages' ? '/management/packages' : '/management/trainers';

  return (
    <CreditWalletProvider><AppShell user={user}>
      <Routes>
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="wallet/payment-result" element={<Navigate to="/wallet" replace />} />
        <Route path="admin/credits" element={<Navigate to="/wallet" replace />} />
        <Route
          path="consultation"
          element={
            <FeatureRoute user={user} roles={['PT']}>
              <ConsultationTool />
            </FeatureRoute>
          }
        />
        <Route path="customers" element={
          <FeatureRoute user={user} roles={['ADMIN', 'PT']}>
            {user.role === 'PT' ? <PtCustomersPage /> : <AdminCustomersPage />}
          </FeatureRoute>
        } />
        <Route path="admin/customers" element={<Navigate to="/customers" replace />} />
        <Route path="pt/customers" element={<Navigate to="/customers" replace />} />
        <Route path="admin/transfers" element={<Navigate to="/transfers" replace />} />
        <Route path="admin/knowledge" element={<Navigate to="/knowledge" replace />} />
        <Route
          path="transfers"
          element={
            <FeatureRoute user={user} roles={['ADMIN']}>
              <AdminTransfersPage />
            </FeatureRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <FeatureRoute user={user} roles={['ADMIN']}>
              <AdminUsersPage user={user} />
            </FeatureRoute>
          }
        />
        <Route
          path="admin/admin-accounts"
          element={
            <FeatureRoute user={user} roles={['SUPER_ADMIN']}>
              <AdminAccountsPage user={user} />
            </FeatureRoute>
          }
        />
        <Route
          path="pt/assistant"
          element={
            <FeatureRoute user={user} roles={['ADMIN', 'PT']}>
              <PtAssistantPage />
            </FeatureRoute>
          }
        />
        <Route
          path="knowledge"
          element={
            <FeatureRoute user={user} roles={['ADMIN']}>
              <AdminKnowledgePage />
            </FeatureRoute>
          }
        />
        <Route path="management/trainers" element={<FeatureRoute user={user} roles={['ADMIN']}><PtManagementView /></FeatureRoute>} />
        <Route path="management/packages" element={<FeatureRoute user={user} roles={['ADMIN']}><PackageTemplateView /></FeatureRoute>} />
        <Route path="management/features" element={<Navigate to="/management/trainers" replace />} />
        <Route path="admin/*" element={<Navigate to={legacyAdminPath} replace />} />
        <Route path="pt/profile" element={<Navigate to="/customers" replace />} />
        <Route
          path="pt/inbody"
          element={
            <FeatureRoute user={user} roles={['ADMIN', 'PT']}>
              <InBodyPage />
            </FeatureRoute>
          }
        />
        <Route
          path="pt/roadmaps/*"
          element={
            <FeatureRoute user={user} roles={['ADMIN', 'PT']}>
              <RoadmapPage />
            </FeatureRoute>
          }
        />
        <Route path="pt/exercises" element={<Navigate to="/pt/my-workout-plans?tab=exercises" replace />} />
        <Route
          path="pt/my-workout-plans/new"
          element={<FeatureRoute user={user} roles={['ADMIN', 'PT']}><WorkoutStudioPage /></FeatureRoute>}
        />
        <Route
          path="pt/my-workout-plans/:templateId/edit"
          element={<FeatureRoute user={user} roles={['ADMIN', 'PT']}><WorkoutStudioPage /></FeatureRoute>}
        />
        <Route
          path="pt/my-workout-plans"
          element={
            <FeatureRoute user={user} roles={['ADMIN', 'PT']}>
              <MyWorkoutPlans />
            </FeatureRoute>
          }
        />
        <Route
          path="pt/customers/:customerId/workout-plans/:planId/edit"
          element={<FeatureRoute user={user} roles={['ADMIN', 'PT']}><WorkoutStudioPage /></FeatureRoute>}
        />
        <Route
          path="pt/customer-workout-plans"
          element={<Navigate to="/customers" replace />}
        />
        <Route path="pt/workout-plans/*" element={<Navigate to="/pt/my-workout-plans" replace />} />
        <Route path="pt/workouts" element={<Navigate to="/pt/my-workout-plans" replace />} />
        <Route
          path="pt/progress/*"
          element={
            <FeatureRoute user={user} roles={['ADMIN', 'PT']}>
              <ProgressPage />
            </FeatureRoute>
          }
        />
        <Route path="pt/nutrition-assistant" element={<Navigate to="/pt/assistant" replace />} />
        <Route
          path="pt/nutrition"
          element={
            <FeatureRoute user={user} roles={['ADMIN', 'PT']}>
              <NutritionPage />
            </FeatureRoute>
          }
        />
        <Route path="pt/care" element={<Navigate to="/pt/dashboard" replace />} />
        <Route
          path="pt/dashboard"
          element={
            <FeatureRoute user={user} roles={['PT']}>
              {GYM_DASHBOARD_VISIBLE ? (
                <FeatureRoute user={user} roles={['PT']}>
                  <PtDashboardPage />
                </FeatureRoute>
              ) : (
                <Navigate to="/customers" replace />
              )}
            </FeatureRoute>
          }
        />
        <Route
          path="pt/customers/*"
          element={
            <FeatureRoute user={user} roles={['PT']}>
              <Navigate to="/customers" replace />
            </FeatureRoute>
          }
        />
        <Route
          path="pt/*"
          element={
            <FeatureRoute user={user} roles={['PT']}>
              <Navigate to="/customers" replace />
            </FeatureRoute>
          }
        />
        <Route
          path="me/assistant"
          element={
            <FeatureRoute user={user} roles={['CUSTOMER']}>
              <PtAssistantPage />
            </FeatureRoute>
          }
        />
        <Route
          path="me/*"
          element={
            <FeatureRoute user={user} roles={['CUSTOMER']}>
              <CustomerPortalPage />
            </FeatureRoute>
          }
        />
        <Route
          path="*"
          element={
            isPortalRoot ? (
              <Navigate to={roleDestinations[user.role]} replace />
            ) : (
              <PortalNotFound destination={roleDestinations[user.role]} roleLabel={roleLabels[user.role]} />
            )
          }
        />
      </Routes>
    </AppShell></CreditWalletProvider>
  );
}

export default function PortalRoutes({ session: providedSession }: { session?: Session }) {
  const session = providedSession || getSession();
  const [user, setUser] = useState<User>(session?.user || { username: '', role: 'CUSTOMER' });

  useEffect(() => {
    let mounted = true;

    // Tự động đồng bộ profile mới nhất từ backend (/api/auth/me) khi tải trang
    api
      .get<User>('/api/auth/me')
      .then((res) => {
        if (mounted && res.data && res.data.id) {
          const latestUser = res.data;
          setUser((prev) => ({ ...prev, ...latestUser }));
          const current = getSession();
          if (current) {
            saveSession({ token: current.token, user: { ...current.user, ...latestUser } });
          }
        }
      })
      .catch(() => {
        // Bỏ qua nếu offline
      });

    const handleProfileUpdated = (e: Event) => {
      const updated = (e as CustomEvent<User>).detail;
      if (updated) {
        setUser((prev) => ({ ...prev, ...updated }));
        const current = getSession();
        if (current) {
          saveSession({ token: current.token, user: { ...current.user, ...updated } });
        }
      }
    };
    window.addEventListener('3s:user-profile-updated', handleProfileUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('3s:user-profile-updated', handleProfileUpdated);
    };
  }, []);

  return (
    <PortalContent user={user} />
  );
}
