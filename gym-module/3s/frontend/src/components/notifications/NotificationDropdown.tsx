import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, ChevronLeft, ChevronRight, Inbox, RotateCcw } from 'lucide-react';
import { api } from '../../services/api';
import type { PaginationMeta } from '../../types';
import { errorMessage } from '../../types';
import type { Notification } from './NotificationList';

const destinations: Record<string, string> = {
  calendarEvents: '/calendar',
  progressReports: '/me',
  careTask: '/pt/dashboard',
  careAlert: '/pt/dashboard',
};

interface NotificationDropdownProps {
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export default function NotificationDropdown({ onClose, onUnreadCountChange }: NotificationDropdownProps) {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 5, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        const result = await api.get<Notification[]>(`/api/notifications?page=${page}&limit=5`);
        setItems(result.data || []);
        if (result.meta) {
          setMeta(result.meta);
        }
        const unread = (result.data || []).filter((item) => !item.readAt).length;
        if (onUnreadCountChange) {
          onUnreadCountChange(unread);
        }
      } catch (error) {
        // Silently handle error in dropdown
      } finally {
        setLoading(false);
      }
    },
    [onUnreadCountChange]
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  // Click outside to close & Escape key handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleOpenItem = async (item: Notification) => {
    try {
      if (!item.readAt) {
        await api.patch(`/api/notifications/${item._id}/read`, {});
        setItems((current) =>
          current.map((v) => (v._id === item._id ? { ...v, readAt: new Date().toISOString() } : v))
        );
        if (onUnreadCountChange) {
          const currentUnread = items.filter((v) => !v.readAt && v._id !== item._id).length;
          onUnreadCountChange(currentUnread);
        }
      }
      onClose();
      const destination = destinations[item.resourceType];
      if (destination) {
        navigate(destination);
      }
    } catch {
      onClose();
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadItems = items.filter((item) => !item.readAt);
    if (!unreadItems.length) return;
    try {
      setMarkingAll(true);
      await Promise.all(unreadItems.map((item) => api.patch(`/api/notifications/${item._id}/read`, {})));
      setItems((current) => current.map((v) => ({ ...v, readAt: v.readAt || new Date().toISOString() })));
      if (onUnreadCountChange) {
        onUnreadCountChange(0);
      }
    } catch {
      // Ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadInPage = items.filter((item) => !item.readAt).length;

  return (
    <div className="portal-notification-dropdown" ref={dropdownRef} role="dialog" aria-label="Hộp thông báo">
      <div className="notif-dropdown-header">
        <div className="notif-dropdown-title">
          <strong>Thông báo</strong>
          {unreadInPage > 0 && <span className="notif-count-chip">{unreadInPage} mới</span>}
        </div>
        <div className="notif-dropdown-actions">
          {unreadInPage > 0 && (
            <button
              type="button"
              className="notif-action-btn"
              title="Đánh dấu tất cả đã đọc"
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
            >
              <CheckCheck size={14} />
              <span>Đã đọc tất cả</span>
            </button>
          )}
          <button
            type="button"
            className="notif-action-btn notif-icon-only"
            title="Tải lại thông báo"
            aria-label="Tải lại"
            onClick={() => void load(meta.page)}
            disabled={loading}
          >
            <RotateCcw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div className="notif-dropdown-body">
        {loading && items.length === 0 ? (
          <div className="notif-dropdown-loading">Đang tải thông báo...</div>
        ) : items.length > 0 ? (
          <div className="notif-dropdown-list">
            {items.map((item) => {
              const isUnread = !item.readAt;
              return (
                <button
                  type="button"
                  key={item._id}
                  className={`notif-dropdown-item ${isUnread ? 'is-unread' : ''}`}
                  onClick={() => void handleOpenItem(item)}
                >
                  <div className="notif-item-indicator" aria-hidden="true" />
                  <div className="notif-item-content">
                    <strong className="notif-item-title">{item.title}</strong>
                    <p className="notif-item-msg">{item.message}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="notif-dropdown-empty">
            <Inbox size={28} className="empty-icon" aria-hidden="true" />
            <span>Không có thông báo nào.</span>
          </div>
        )}
      </div>

      {meta.totalPages > 1 && (
        <div className="notif-dropdown-footer">
          <button
            type="button"
            className="notif-page-btn"
            disabled={meta.page <= 1 || loading}
            onClick={() => void load(meta.page - 1)}
            aria-label="Trang trước"
          >
            <ChevronLeft size={15} />
          </button>

          <span className="notif-page-info">
            Trang <strong>{meta.page}</strong> / {meta.totalPages}
          </span>

          <button
            type="button"
            className="notif-page-btn"
            disabled={meta.page >= meta.totalPages || loading}
            onClick={() => void load(meta.page + 1)}
            aria-label="Trang sau"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
