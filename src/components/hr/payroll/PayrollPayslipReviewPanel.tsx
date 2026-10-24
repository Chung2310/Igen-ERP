import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { payrollService } from "../../../services/payrollService";
import { getApiErrorMessage } from "../../../utils/errorMessage";
import type { PayslipReviewRequest } from "../../../shared/payrollPayslipReview";
import { PayslipReviewMessageDialog } from "./PayslipReviewMessageDialog";

type Props = { runId: string; canManage: boolean };

export function PayrollPayslipReviewPanel({ runId, canManage }: Props) {
  const [items, setItems] = useState<PayslipReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PayslipReviewRequest | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void payrollService.getRunPayslipReviews(runId)
      .then((records) => { if (active) setItems(records); })
      .catch((cause) => { if (active) setError(getApiErrorMessage(cause, "Không thể tải yêu cầu kiểm tra lại lương.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [runId, reloadVersion]);

  const resolve = async (response: string) => {
    if (!selected) return;
    const updated = await payrollService.resolvePayslipReview(runId, selected.id, response);
    setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-on-surface" aria-labelledby="payslip-review-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="payslip-review-heading" className="text-balance text-base font-semibold">Yêu cầu kiểm tra lại phiếu lương</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums text-on-surface-variant">{items.filter((item) => item.status === "open").length} đang chờ</span>
          <button type="button" aria-label="Tải lại yêu cầu kiểm tra lương" disabled={loading} onClick={() => setReloadVersion((value) => value + 1)} className="flex size-11 items-center justify-center rounded-lg border border-outline text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><RefreshCw size={16} aria-hidden="true" /></button>
        </div>
      </div>
      {loading && <p role="status" className="mt-3 text-sm text-on-surface-variant">Đang tải yêu cầu...</p>}
      {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="mt-3 text-pretty text-sm text-on-surface-variant">Chưa có yêu cầu nào cho kỳ lương này.</p>}
      {!loading && !error && items.length > 0 && (
        <ul className="mt-3 divide-y divide-outline-variant">
          {items.map((item) => (
            <li key={item.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{item.employeeName} <span className="text-sm font-normal text-on-surface-variant">({item.employeeId})</span></p>
                  <p className="whitespace-pre-wrap text-pretty text-sm">{item.message}</p>
                  <p className="text-xs text-on-surface-variant">{item.status === "open" ? "Đang chờ phản hồi" : "Đã phản hồi"}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString("vi-VN")}` : ""}</p>
                  {item.response && <p className="whitespace-pre-wrap text-pretty text-sm text-on-surface-variant">Phản hồi: {item.response}</p>}
                </div>
                {canManage && item.status === "open" && <button type="button" onClick={() => setSelected(item)} className="min-h-11 rounded-lg border border-outline px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">Phản hồi</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {selected && <PayslipReviewMessageDialog title="Phản hồi yêu cầu kiểm tra lại" description={`Nhân viên: ${selected.employeeName} · Kỳ ${selected.periodKey}`} label="Nội dung phản hồi" submitLabel="Gửi phản hồi" maxLength={4000} onClose={() => setSelected(null)} onSubmit={resolve} />}
    </section>
  );
}
