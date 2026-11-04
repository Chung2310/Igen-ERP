import { useEffect, useState } from "react";
import { Clock, RefreshCw, Save } from "lucide-react";
import { StyledSelect } from "../../common/StyledSelect";
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
    <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant pb-3">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-primary" />
          <h3 className="text-base font-medium text-on-surface text-balance">Lịch tự động phát hành lương tạm tính</h3>
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
                className="w-16 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-center text-xs text-on-surface tabular-nums outline-none focus:border-primary"
              />
            </label>

            <div className="flex items-center gap-1.5 font-medium text-on-surface-variant">
              <span>Giờ phát hành</span>
              <StyledSelect
                appearance="erp"
                ariaLabel="Giờ phát hành"
                value={String(schedule.hour).padStart(2, "0")}
                options={Array.from({ length: 24 }, (_, hour) => ({ value: String(hour).padStart(2, "0"), label: String(hour).padStart(2, "0") }))}
                disabled={!canManage || busy}
                onChange={value => update({ hour: Number(value) })}
                className="h-9 w-20 rounded-lg px-2 text-xs tabular-nums"
              />
              <span aria-hidden="true">:</span>
              <StyledSelect
                appearance="erp"
                ariaLabel="Phút phát hành"
                value={String(schedule.minute).padStart(2, "0")}
                options={Array.from({ length: 60 }, (_, minute) => ({ value: String(minute).padStart(2, "0"), label: String(minute).padStart(2, "0") }))}
                disabled={!canManage || busy}
                onChange={value => update({ minute: Number(value) })}
                className="h-9 w-20 rounded-lg px-2 text-xs tabular-nums"
              />
            </div>

            <div className="flex items-center gap-1.5 font-medium text-on-surface-variant">
              <span>Kỳ lương được phát hành</span>
              <StyledSelect
                appearance="erp"
                ariaLabel="Kỳ lương được phát hành"
                value={String(schedule.periodOffset)}
                options={[{ value: "0", label: "Tháng hiện tại" }, { value: "-1", label: "Tháng trước" }]}
                onChange={value => update({ periodOffset: Number(value) as 0 | -1 })}
                disabled={!canManage || busy}
                className="h-9 w-40 rounded-lg px-2.5 text-xs"
              />
            </div>

            {canManage && (
              <button
                type="submit"
                disabled={busy}
                className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-medium text-on-primary hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
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
