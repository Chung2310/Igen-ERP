import { useEffect, useState } from "react";
import { AlertCircle, Calendar, ChevronDown, Clock, FileText, Inbox, RefreshCw, ShieldCheck } from "lucide-react";
import { payrollService } from "../../../services/payrollService";
import type { PayrollReconciliation } from "../../../shared/payrollReconciliation";
import { PayrollReconciliationConversation } from "./PayrollReconciliationConversation";

export function EmployeePayrollReconciliation() {
  const [items, setItems] = useState<PayrollReconciliation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await payrollService.getMyReconciliation();
      setItems(Array.isArray(data) ? data : []);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Không thể tải bảng đối soát lương");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="space-y-3.5 rounded-2xl border border-primary/20 bg-surface-container-lowest p-4 sm:p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <FileText size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-on-surface">Bảng lương tạm tính — Đối soát & Khiếu nại</h2>
            <p className="text-xs text-on-surface-variant">
              Kiểm tra các khoản lương, gửi thắc mắc khi có sai lệch và xác nhận số liệu kỳ lương của bạn.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface hover:border-slate-300 disabled:opacity-50 cursor-pointer shadow-2xs transition-colors"
          onClick={() => void load()}
        >
          <RefreshCw size={13} className={loading ? "animate-spin text-primary" : "text-on-surface-variant"} />
          Tải lại đối soát
        </button>
      </div>

      {loading && !items.length && (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-on-surface-variant">
          <RefreshCw size={15} className="animate-spin text-primary" />
          <span>Đang tải bảng lương tạm tính...</span>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle size={15} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && !items.length && (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Inbox size={28} className="text-slate-300" />
          <p className="text-sm font-semibold text-on-surface-variant">Chưa có bảng tạm tính được phát hành cho bạn</p>
          <p className="text-xs text-slate-400">
            Khi phòng nhân sự/kế toán phát hành số liệu tạm tính của kỳ, bạn sẽ nhận được thông báo để đối soát tại đây.
          </p>
        </div>
      )}

      {items.map(record => {
        const isDraft = record.runStatus === "draft";
        return (
          <details
            key={record.runId}
            className="group rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-2xs transition-colors"
            open={isDraft}
          >
            <summary className="flex items-center justify-between font-bold text-on-surface cursor-pointer select-none">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-primary" />
                <span className="text-sm">Kỳ {record.periodKey}</span>
                <span className="text-slate-300">·</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  isDraft
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-slate-100 text-on-surface-variant border border-outline-variant"
                }`}>
                  {isDraft ? "Đang đối soát" : "Đã chuyển chốt lương"}
                </span>
              </div>
              <ChevronDown size={15} className="text-slate-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="mt-4 border-t border-outline-variant pt-3">
              <PayrollReconciliationConversation
                record={record}
                onAction={async action => {
                  await payrollService.actMyReconciliation(record.runId, { ...action, expectedVersion: record.version });
                  await load();
                }}
              />
            </div>
          </details>
        );
      })}
    </section>
  );
}
