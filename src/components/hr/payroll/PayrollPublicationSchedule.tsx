import { useEffect, useState } from "react";
import { Calendar, Clock, RefreshCw, Save } from "lucide-react";
import { payrollService } from "../../../services/payrollService";
import type { PayrollPublicationSchedule as Schedule } from "../../../shared/payrollPublicationSchedule";

export function PayrollPublicationSchedule({ canManage }: { canManage: boolean }) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setError("");
    setSaved(false);
    try {
      setSchedule(await payrollService.getReconciliationSchedule());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được lịch phát hành.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const update = (values: Partial<Schedule>) => {
    setSchedule(current => current ? { ...current, ...values } : current);
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      setSchedule(await payrollService.saveReconciliationSchedule(schedule));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được lịch phát hành.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-on-surface">Lịch tự động phát hành lương tạm tính</h3>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
          Tải lại lịch phát hành
        </button>
      </div>

      {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">{error}</p>}
      {saved && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-700">Đã lưu lịch phát hành.</p>}
      {!schedule && !error && <p className="text-xs text-slate-400">Đang tải lịch...</p>}

      {schedule && (
        <form onSubmit={event => { event.preventDefault(); void save(); }}>
          <fieldset disabled={!canManage || busy} className="flex flex-wrap items-center gap-3 disabled:opacity-60 text-xs">
            <label className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface/70 px-3 py-2 font-medium text-on-surface-variant cursor-pointer">
              <input
                type="checkbox"
                checked={schedule.enabled}
                onChange={event => update({ enabled: event.target.checked })}
                className="rounded accent-primary cursor-pointer"
              />
              Tự động phát hành hằng tháng
            </label>

            <label className="flex items-center gap-1.5 font-medium text-on-surface-variant">
              Ngày trong tháng
              <input
                type="number"
                min={1}
                max={31}
                step={1}
                required
                value={schedule.day}
                onChange={event => update({ day: event.target.valueAsNumber })}
                className="w-16 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-indigo-500 text-center font-bold"
              />
            </label>

            <label className="flex items-center gap-1.5 font-medium text-on-surface-variant">
              Giờ phát hành
              <input
                type="time"
                required
                value={`${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`}
                onChange={event => {
                  const [hour, minute] = event.target.value.split(":").map(Number);
                  update({ hour, minute });
                }}
                className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-indigo-500 font-bold"
              />
            </label>

            <label className="flex items-center gap-1.5 font-medium text-on-surface-variant">
              Kỳ lương được phát hành
              <select
                value={schedule.periodOffset}
                onChange={event => update({ periodOffset: Number(event.target.value) as 0 | -1 })}
                className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-xs text-on-surface outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value={0}>Tháng hiện tại</option>
                <option value={-1}>Tháng trước</option>
              </select>
            </label>

            {canManage && (
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-on-primary hover:bg-primary cursor-pointer shadow-xs disabled:opacity-50 transition-colors ml-auto"
              >
                <Save size={13} />
                {busy ? "Đang lưu..." : "Lưu lịch phát hành"}
              </button>
            )}
          </fieldset>
        </form>
      )}
    </section>
  );
}
