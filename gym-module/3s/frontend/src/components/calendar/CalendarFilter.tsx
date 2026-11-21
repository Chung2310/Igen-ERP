import { Calendar, RotateCcw } from 'lucide-react';
import CustomDatePicker from '../ui/CustomDatePicker';

interface CalendarFilterProps {
  dates: { fromDate: string; toDate: string };
  onDatesChange: (dates: { fromDate: string; toDate: string }) => void;
}

export default function CalendarFilter({ dates, onDatesChange }: CalendarFilterProps) {
  const hasActiveFilter = Boolean(dates.fromDate || dates.toDate);

  return (
    <div style={{ padding: '0 0 10px', marginBottom: '12px', borderBottom: '1px solid #d8e2f0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: '#475569' }}>
            <Calendar size={15} aria-hidden="true" color="#00adfc" />
            <span>Khoảng ngày:</span>
          </div>
          <div style={{ width: '155px' }}>
            <CustomDatePicker
              ariaLabel="Lịch từ ngày"
              placeholder="Từ ngày"
              value={dates.fromDate}
              max={dates.toDate || undefined}
              onChange={(val) => onDatesChange({ ...dates, fromDate: val })}
            />
          </div>
          <span style={{ color: '#94a3b8', fontSize: '12px' }}>→</span>
          <div style={{ width: '155px' }}>
            <CustomDatePicker
              ariaLabel="Lịch đến ngày"
              placeholder="Đến ngày"
              value={dates.toDate}
              min={dates.fromDate || undefined}
              onChange={(val) => onDatesChange({ ...dates, toDate: val })}
            />
          </div>
        </div>

        <div className="filter-presets" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              onDatesChange({ fromDate: today, toDate: today });
            }}
          >
            Hôm nay
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              const now = new Date();
              const to = new Date().toISOString().slice(0, 10);
              now.setDate(now.getDate() - 7);
              const from = now.toISOString().slice(0, 10);
              onDatesChange({ fromDate: from, toDate: to });
            }}
          >
            7 ngày qua
          </button>
          {hasActiveFilter && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => onDatesChange({ fromDate: '', toDate: '' })}
            >
              <RotateCcw size={13} aria-hidden="true" /> Đặt lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
