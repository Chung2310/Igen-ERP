import { useState } from 'react';
import { api } from '../../services/api';
import { errorMessage } from '../../types';
import { useToast } from '../ui/ToastProvider';
import ProgressSection from './ProgressSection';

interface Draft {
  _id: string;
  summary: string;
  warnings?: string[];
  metrics?: Record<string, number>;
}

const primaryButtonClass = 'inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none';
const secondaryButtonClass = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-primary transition hover:border-secondary/40 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 motion-reduce:transition-none';
const fieldClass = 'min-h-11 rounded-xl border border-slate-300 px-3 outline-none transition focus:border-secondary focus:ring-2 focus:ring-secondary/20';

export default function ProgressReportGenerator({ customerId, onSaved }: { customerId: string; onSaved: () => void }) {
  const toast = useToast();
  const [periodStart, setStart] = useState('');
  const [periodEnd, setEnd] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const result = await api.post<Draft>('/api/progress-reports/generate', { customerId, periodStart, periodEnd });
      setDraft(result.data);
      setSummary(result.data.summary);
      toast.success(result.message);
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    try {
      const result = await api.patch(`/api/progress-reports/${draft._id}`, { summary });
      toast.success(result.message);
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const publish = async () => {
    if (!draft) return;
    try {
      const result = await api.patch(`/api/progress-reports/${draft._id}/publish`);
      toast.success(result.message);
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <ProgressSection
      title="Báo cáo tiến độ"
      description="Tổng hợp tự động từ lịch tập, buổi tập và số đo."
    >
      <div className="space-y-5 font-montserrat">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            <span>Từ ngày</span>
            <input className={fieldClass} type="date" aria-label="Từ ngày" value={periodStart} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">
            <span>Đến ngày</span>
            <input className={fieldClass} type="date" aria-label="Đến ngày" value={periodEnd} onChange={(event) => setEnd(event.target.value)} />
          </label>
        </div>
        <button type="button" className={primaryButtonClass} disabled={!periodStart || !periodEnd || loading} onClick={() => void generate()}>
          {loading ? 'Đang tổng hợp...' : 'Tạo báo cáo tự động'}
        </button>
        {draft && (
          <div className="space-y-4 border-t border-slate-200 pt-5">
            {draft.warnings?.map((warning) => <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" key={warning}>{warning}</p>)}
            <label className="grid gap-1 text-sm font-semibold text-slate-700">
              <span>Nội dung báo cáo</span>
              <textarea className={`${fieldClass} min-h-36 p-3`} aria-label="Nội dung báo cáo" placeholder="Nội dung báo cáo tiến độ..." value={summary} onChange={(event) => setSummary(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondaryButtonClass} onClick={() => void save()}>Lưu chỉnh sửa</button>
              <button type="button" className={primaryButtonClass} onClick={() => void publish()}>Công bố báo cáo</button>
            </div>
          </div>
        )}
      </div>
    </ProgressSection>
  );
}
