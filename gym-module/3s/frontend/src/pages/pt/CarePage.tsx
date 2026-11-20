import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useToast } from '../../components/ui/ToastProvider';
import { errorMessage } from '../../types';
import CareTodayQueue, { type CareItem, type TodayData } from '../../components/care/CareTodayQueue';
import CareTaskModal from '../../components/care/CareTaskModal';
import CareLogPanel from '../../components/care/CareLogPanel';

const empty: TodayData = { overdueTasks: [], dueTodayTasks: [], openAlerts: [] };

export default function CarePage() {
  const toast = useToast();
  const [today, setToday] = useState(empty);
  const [logs, setLogs] = useState<Array<{ _id: string; kind?: string; result?: string }>>([]);
  const [target, setTarget] = useState<{ kind: 'task' | 'alert'; item: CareItem } | null>(null);

  const load = useCallback(async () => {
    try {
      const [queue, history] = await Promise.all([
        api.get<TodayData>(`/api/care/today?date=${new Date().toISOString().slice(0, 10)}`),
        api.get<typeof logs>('/api/care/logs?page=1&limit=20'),
      ]);
      setToday(queue.data);
      setLogs(history.data);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <div className="section-header">
        <div>
          <h1>Việc cần làm hôm nay</h1>
          <p>Ưu tiên công việc quá hạn và cảnh báo cần xử lý.</p>
        </div>
        <button
          className="button button-secondary"
          onClick={() => void api.post('/api/care/recalculate', {}).then(() => load())}
        >
          Tính lại cảnh báo
        </button>
      </div>
      <CareTodayQueue data={today} onAction={(kind, item) => setTarget({ kind, item })} />
      <CareLogPanel logs={logs} />
      <CareTaskModal target={target} onClose={() => setTarget(null)} onSaved={() => void load()} />
    </section>
  );
}
