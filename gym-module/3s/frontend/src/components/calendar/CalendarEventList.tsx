import type { CalendarItem } from './CalendarEventModal';
import type { UserRole } from '../../types';

interface CalendarEventListProps {
  items: CalendarItem[];
  role: UserRole;
  onEdit: (item: CalendarItem) => void;
  onRemove: (item: CalendarItem) => void;
}

export default function CalendarEventList({ items, role, onEdit, onRemove }: CalendarEventListProps) {
  return (
    <ul className="panel calendar-list" aria-label="Danh sách lịch">
      {items.length ? (
        items.map((item) => (
          <li className="published-card" key={item._id}>
            <strong>{item.title}</strong>
            <span>{new Date(item.startsAt).toLocaleString('vi-VN')}</span>
            <span>{item.status}</span>
            {role === 'PT' && (
              <div className="inline-actions">
                <button className="text-button" onClick={() => onEdit(item)}>Sửa</button>
                <button className="text-button text-danger" onClick={() => onRemove(item)}>Xóa</button>
              </div>
            )}
          </li>
        ))
      ) : (
        <div className="empty-state">Không có sự kiện lịch trong khoảng thời gian này.</div>
      )}
    </ul>
  );
}
