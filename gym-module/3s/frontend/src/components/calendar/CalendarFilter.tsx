import { Calendar, RotateCcw } from 'lucide-react';

interface CalendarFilterProps {
  dates: { fromDate: string; toDate: string };
  onDatesChange: (dates: { fromDate: string; toDate: string }) => void;
}

export default function CalendarFilter({ dates, onDatesChange }: CalendarFilterProps) {
  const hasActiveFilter = Boolean(dates.fromDate || dates.toDate);

  return (
    <div className="filter-card" style={{ padding: '12px 16px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#003b70' }}>
            <Calendar size={16} color="var(--secondary-color)" />
            <span>Khoảng ngày:</span>
          </div>
          <label className="filter-field" style={{ minWidth: '150px' }}>
            <span className="sr-only">Từ ngày</span>
            <input
              type="date"
              aria-label="Lịch từ ngày"
              value={dates.fromDate}
              onChange={(e) => onDatesChange({ ...dates, fromDate: e.target.value })}
            />
          </label>
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>→</span>
          <label className="filter-field" style={{ minWidth: '150px' }}>
            <span className="sr-only">Đến ngày</span>
            <input
              type="date"
              aria-label="Lịch đến ngày"
              value={dates.toDate}
              onChange={(e) => onDatesChange({ ...dates, toDate: e.target.value })}
            />
          </label>
        </div>

        <div className="filter-presets">
          <button
            type="button"
            className="filter-preset-chip"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              onDatesChange({ fromDate: today, toDate: today });
            }}
          >
            Hôm nay
          </button>
          <button
            type="button"
            className="filter-preset-chip"
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
              className="button-filter-reset"
              style={{ height: '26px', padding: '0 8px', fontSize: '0.74rem' }}
              onClick={() => onDatesChange({ fromDate: '', toDate: '' })}
            >
              <RotateCcw size={12} /> Đặt lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
