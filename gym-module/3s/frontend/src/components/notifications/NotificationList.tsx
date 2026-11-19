interface Notification {
  _id: string;
  title: string;
  message: string;
  resourceType: string;
  resourceId: string;
  readAt: string | null;
}

interface NotificationListProps {
  items: Notification[];
  onOpen: (item: Notification) => void;
}

export type { Notification };

export default function NotificationList({ items, onOpen }: NotificationListProps) {
  return (
    <div className="panel">
      {items.length ? (
        items.map((item) => (
          <button
            className="published-card notification-item"
            key={item._id}
            onClick={() => onOpen(item)}
          >
            <strong>{item.title}</strong>
            <span>{item.message}</span>
          </button>
        ))
      ) : (
        <div className="empty-state">Chưa có thông báo.</div>
      )}
    </div>
  );
}
