import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from '../components/AppShell';
import PortalNotFound from '../components/PortalNotFound';
import FeatureRoute from '../components/FeatureRoute';
import AdminRoutes from './AdminRoutes';

// Pages
import InBodyPage from '../pages/pt/InBodyPage';
import PtCustomersPage from '../pages/pt/PtCustomersPage';
import PtDashboardPage from '../pages/pt/PtDashboardPage';
import PtProfilePage from '../pages/pt/PtProfilePage';
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
import WalletPage from '../pages/common/WalletPage';
import PaymentResultPage from '../pages/common/PaymentResultPage';
import CreditAdminPage from '../pages/admin/CreditAdminPage';

import { FeaturesProvider, useFeatures } from '../services/features';
import { getSession, saveSession } from '../services/session';
import { api } from '../services/api';
import type { Session, User } from '../types';
import { CreditWalletProvider } from '../contexts/CreditWalletContext';

const roleDestinations = {
  SUPER_ADMIN: '/admin',
  ADMIN: '/admin',
  PT: '/pt/customers',
  CUSTOMER: '/me',
} as const;
const roleLabels = { SUPER_ADMIN: 'quản trị cấp cao', ADMIN: 'ADMIN', PT: 'PT', CUSTOMER: 'khách hàng' } as const;

function PortalContent({ user, onUserUpdated }: { user: User; onUserUpdated?: (user: User) => void }) {
  const { features } = useFeatures();
  const location = useLocation();
  const isPortalRoot = location.pathname === '/portal' || location.pathname === '/portal/' || location.pathname === '/';

  return (
    <CreditWalletProvider><AppShell user={user} features={features}>
      <Routes>
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="wallet/payment-result" element={<PaymentResultPage />} />
        <Route path="admin/credits" element={<FeatureRoute user={user} roles={['ADMIN']}><CreditAdminPage /></FeatureRoute>} />
        <Route
          path="consultation"
          element={
            <FeatureRoute user={user} roles={['PT']}>
              <ConsultationTool />
            </FeatureRoute>
          }
        />
        <Route
          path="admin/customers"
          element={
            <FeatureRoute user={user} roles={['ADMIN']}>
              <AdminCustomersPage />
            </FeatureRoute>
          }
        />
        <Route
          path="admin/transfers"
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
            <FeatureRoute user={user} roles={['PT']}>
              <PtAssistantPage />
            </FeatureRoute>
          }
        />
        <Route
          path="admin/knowledge"
          element={
            <FeatureRoute user={user} roles={['ADMIN']}>
              <AdminKnowledgePage />
            </FeatureRoute>
          }
        />
        <Route
          path="admin/*"
          element={
            <FeatureRoute user={user} roles={['ADMIN']}>
              <AdminRoutes />
            </FeatureRoute>
          }
        />
        <Route
          path="pt/profile"
          element={
            <FeatureRoute user={user} roles={['PT']}>
              <PtProfilePage user={user} onUserUpdated={onUserUpdated} />
            </FeatureRoute>
          }
        />
        <Route
          path="pt/inbody"
          element={
            <FeatureRoute user={user} roles={['PT']} feature="OCR_INBODY">
              <InBodyPage />
            </FeatureRoute>
          }
        />
        <Route
          path="pt/roadmaps/*"
          element={
            <FeatureRoute user={user} roles={['PT']} feature="ROADMAP">
              <RoadmapPage />
            </FeatureRoute>
          }
        />
        <Route path="pt/exercises" element={<Navigate to="/pt/my-workout-plans?tab=exercises" replace />} />
        <Route
          path="pt/my-workout-plans/new"
          element={<FeatureRoute user={user} roles={['PT']} feature="EXERCISE_LIBRARY"><WorkoutStudioPage /></FeatureRoute>}
        />
        <Route
          path="pt/my-workout-plans/:templateId/edit"
          element={<FeatureRoute user={user} roles={['PT']} feature="EXERCISE_LIBRARY"><WorkoutStudioPage /></FeatureRoute>}
        />
        <Route
          path="pt/my-workout-plans"
          element={
            <FeatureRoute user={user} roles={['PT']} feature="EXERCISE_LIBRARY">
              <MyWorkoutPlans />
            </FeatureRoute>
          }
        />
        <Route
          path="pt/customers/:customerId/workout-plans/:planId/edit"
          element={<FeatureRoute user={user} roles={['PT']} feature="EXERCISE_LIBRARY"><WorkoutStudioPage /></FeatureRoute>}
        />
        <Route
          path="pt/customer-workout-plans"
          element={<Navigate to="/pt/customers" replace />}
        />
        <Route path="pt/workout-plans/*" element={<Navigate to="/pt/my-workout-plans" replace />} />
        <Route path="pt/workouts" element={<Navigate to="/pt/my-workout-plans" replace />} />
        <Route
          path="pt/progress/*"
          element={
            <FeatureRoute user={user} roles={['PT']} feature="PROGRESS">
              <ProgressPage />
            </FeatureRoute>
          }
        />
        <Route path="pt/nutrition-assistant" element={<Navigate to="/pt/assistant" replace />} />
        <Route
          path="pt/nutrition"
          element={
            <FeatureRoute user={user} roles={['PT']} feature="NUTRITION_AI">
              <NutritionPage />
            </FeatureRoute>
          }
        />
        <Route path="pt/care" element={<Navigate to="/pt/dashboard" replace />} />
        <Route
          path="pt/dashboard"
          element={
            <FeatureRoute user={user} roles={['PT']} feature="DASHBOARD">
              <PtDashboardPage />
            </FeatureRoute>
          }
        />
        <Route
          path="pt/customers/*"
          element={
            <FeatureRoute user={user} roles={['PT']}>
              <PtCustomersPage />
            </FeatureRoute>
          }
        />
        <Route
          path="pt/*"
          element={
            <FeatureRoute user={user} roles={['PT']}>
              <PtCustomersPage />
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

  const handleUserUpdated = (updated: User) => {
    setUser((prev) => ({ ...prev, ...updated }));
    const current = getSession();
    if (current) {
      saveSession({ token: current.token, user: { ...current.user, ...updated } });
    }
  };

  return (
    <FeaturesProvider>
      <PortalContent user={user} onUserUpdated={handleUserUpdated} />
    </FeaturesProvider>
  );
}
