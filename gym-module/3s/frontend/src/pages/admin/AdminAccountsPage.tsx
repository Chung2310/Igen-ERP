import AdminAccountManagementView from '../../components/admin/AdminAccountManagementView';
import type { User } from '../../types';

export default function AdminAccountsPage({ user }: { user: User }) {
  return <AdminAccountManagementView actor={user} />;
}
