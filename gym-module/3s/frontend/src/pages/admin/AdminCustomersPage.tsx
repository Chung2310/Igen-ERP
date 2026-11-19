import { useNavigate } from 'react-router-dom';
import AdminCustomersView from '../../components/admin/AdminCustomersView';

export default function AdminCustomersPage() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '4px 0' }}>
      <AdminCustomersView onOpenTransferTab={() => navigate('/admin/transfers')} />
    </div>
  );
}
