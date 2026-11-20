import UserManagementView from '../../components/admin/UserManagementView';
import type { User } from '../../types';

export default function AdminUsersPage({ user }: { user: User }) {
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '4px 0' }}>
      <UserManagementView actor={user} />
    </div>
  );
}
