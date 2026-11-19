import { useEffect, useState, type FormEvent } from 'react';
import { Calendar, X } from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import CustomerSelect from '../ui/CustomerSelect';
import { errorMessage } from '../../types';

export interface CalendarItem {
  _id: string;
  customerId?: string;
  title: string;
  startsAt: string;
  endsAt: string;
  notes?: string;
  status: string;
}

const local = (value = '') => (value ? new Date(value).toISOString().slice(0, 16) : '');

export default function CalendarEventModal({
  open,
  event,
  onClose,
  onSaved,
}: {
  open: boolean;
  event?: CalendarItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    title: '',
    startsAt: '',
    endsAt: '',
    notes: '',
    status: 'SCHEDULED',
  });

  useEffect(() => {
    if (open) {
      setForm(
        event
          ? {
              customerId: event.customerId || '',
              title: event.title,
              startsAt: local(event.startsAt),
              endsAt: local(event.endsAt),
              notes: event.notes || '',
              status: event.status,
            }
          : {
              customerId: '',
              title: '',
              startsAt: '',
              endsAt: '',
              notes: '',
              status: 'SCHEDULED',
            }
      );
    }
  }, [event, open]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = {
        ...form,
        ...(form.customerId ? {} : { customerId: undefined }),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
      };
      const result = event
        ? await api.patch(`/api/calendar-events/${event._id}`, body)
        : await api.post('/api/calendar-events', body);
      toast.success(result.message);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const change = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        role="dialog"
        aria-label={event ? 'Sửa lịch' : 'Tạo lịch'}
        className="modal"
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: '640px',
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px 28px',
          boxShadow: '0 20px 40px -10px rgba(0, 59, 112, 0.25)',
          position: 'relative',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            paddingBottom: '14px',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 750, color: '#003b70' }}>
                {event ? 'Sửa lịch hẹn & tập luyện' : 'Tạo lịch hẹn & tập luyện'}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Quản lý buổi tập, tư vấn và lịch nhắc nhở nội bộ
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Đóng"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'all 0.15s ease',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Fields */}
        <div className="form-grid" style={{ gap: '16px 14px' }}>
          {/* Tên lịch */}
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>
              Tên lịch <strong style={{ color: '#e11d48' }}>*</strong>
            </span>
            <input
              aria-label="Tên lịch"
              placeholder="vd: Buổi tập PT 1-1, Đánh giá InBody..."
              value={form.title}
              onChange={(e) => change('title', e.target.value)}
              required
            />
          </label>

          {/* Học viên */}
          <div style={{ gridColumn: '1 / -1' }}>
            <CustomerSelect
              label="Học viên / Khách hàng"
              name="customerId"
              ariaLabel="Mã khách hàng của lịch"
              value={form.customerId}
              onChange={(val) => change('customerId', val)}
              placeholder="Chọn học viên liên quan (không bắt buộc)..."
            />
          </div>

          {/* Bắt đầu */}
          <label className="field">
            <span>
              Bắt đầu <strong style={{ color: '#e11d48' }}>*</strong>
            </span>
            <input
              aria-label="Bắt đầu"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => change('startsAt', e.target.value)}
              required
            />
          </label>

          {/* Kết thúc */}
          <label className="field">
            <span>
              Kết thúc <strong style={{ color: '#e11d48' }}>*</strong>
            </span>
            <input
              aria-label="Kết thúc"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => change('endsAt', e.target.value)}
              required
            />
          </label>

          {/* Ghi chú */}
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Ghi chú</span>
            <textarea
              aria-label="Ghi chú lịch"
              placeholder="Nội dung chi tiết, bài tập trọng tâm, lưu ý đặc biệt..."
              rows={3}
              value={form.notes}
              onChange={(e) => change('notes', e.target.value)}
            />
          </label>
        </div>

        {/* Modal Actions Footer */}
        <div
          className="modal-actions"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '22px',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.86rem',
            }}
          >
            Đóng
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={loading}
            style={{
              padding: '9px 22px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.86rem',
              background: '#003b70',
              color: '#ffffff',
            }}
          >
            {loading ? 'Đang lưu...' : 'Lưu lịch'}
          </button>
        </div>
      </form>
    </div>
  );
}
