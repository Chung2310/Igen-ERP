import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Pagination from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/ToastProvider';
import { api } from '../../services/api';
import type { PaginationMeta } from '../../types';
import { errorMessage } from '../../types';

// Components (mảnh UI)
import NotificationList, { type Notification } from '../../components/notifications/NotificationList';

const destinations: Record<string, string> = {
  calendarEvents: '/calendar',
  progressReports: '/me',
  careTask: '/pt/dashboard',
  careAlert: '/pt/dashboard',
};

export default function NotificationsPage() {
  const toast = useToast();
  const navigate = useNavigate();

  // === STATE ===
  const [items, setItems] = useState<Notification[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, totalPages: 0 });

  // === DATA FETCHING ===
  const load = useCallback(async (page = 1) => {
    try {
      const result = await api.get<Notification[]>(`/api/notifications?page=${page}&limit=20`);
      setItems(result.data);
      if (result.meta) setMeta(result.meta);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  // === ACTION HANDLERS ===
  const handleOpen = async (item: Notification) => {
    try {
      if (!item.readAt) {
        await api.patch(`/api/notifications/${item._id}/read`, {});
        setItems((current) =>
          current.map((v) => v._id === item._id ? { ...v, readAt: new Date().toISOString() } : v)
        );
      }
      const destination = destinations[item.resourceType];
      if (destination) navigate(destination);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const unread = items.filter((item) => !item.readAt).length;

  // === LẮP RÁP COMPONENTS ===
  return (
    <section>
      <div className="section-header">
        <div>
          <h1>Thông báo</h1>
          <p aria-label={`${unread} thông báo chưa đọc`}>{unread} chưa đọc</p>
        </div>
      </div>

      <NotificationList items={items} onOpen={handleOpen} />

      <Pagination page={meta.page || 1} totalPages={meta.totalPages || 0} onPageChange={load} />
    </section>
  );
}
