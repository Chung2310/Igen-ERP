import { useEffect, useRef, useState } from "react";
import { Printer, Eye, X } from "lucide-react";
import { payrollService } from "../../services/payrollService";
import { buildPayrollDetails } from "./payrollDetails";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { EmployeePayrollReconciliation } from "./payroll/EmployeePayrollReconciliation";
import { PayslipReviewMessageDialog } from "./payroll/PayslipReviewMessageDialog";
import type { PayslipReviewRequest } from "../../shared/payrollPayslipReview";

type Payslip = { runId: string; periodKey?: string; employeeId: string; employeeName?: string; netPay: number; paidAmount: number; balance: number };
const formatVnd = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value) || 0);

export default function EmployeePayslips() {
  const [items, setItems] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [printError, setPrintError] = useState("");
  const [reviews, setReviews] = useState<PayslipReviewRequest[]>([]);
  const [reviewsError, setReviewsError] = useState("");
  const [reviewItem, setReviewItem] = useState<Payslip | null>(null);
  const detailDialogRef = useRef<HTMLDialogElement>(null);
  const detailOpen = Boolean(selectedItem);

  useEffect(() => {
    if (!detailOpen) return;
    const dialog = detailDialogRef.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      trigger?.focus();
    };
  }, [detailOpen]);

  useEffect(() => {
    void payrollService.getEmployeePayslips()
      .then(setItems)
      .catch((e) => setError(getApiErrorMessage(e, "Không thể tải phiếu lương.")))
      .finally(() => setLoading(false));
    void payrollService.getMyPayslipReviews()
      .then(setReviews)
      .catch((cause) => setReviewsError(getApiErrorMessage(cause, "Không thể tải yêu cầu kiểm tra lại lương.")));
  }, []);

  const openDetail = async (item: Payslip) => {
    setSelectedItem(item);
    setDetailError("");
    setDetailLoading(true);
    try {
      const detail = await payrollService.getLineDetail(item.runId, item.employeeId);
      setSelectedItem({
        ...item,
        attendance: detail.attendance || {},
        calculation: detail.calculation || {},
        vietnam: detail.vietnam || {}
      });
    } catch (cause) {
      setDetailError(getApiErrorMessage(cause, "Không thể tải chi tiết phiếu lương."));
    } finally {
      setDetailLoading(false);
    }
  };

  const printPayslip = async (item: Payslip) => {
    setPrintError("");
    try {
      const blob = await payrollService.printPayslip(item.runId, item.employeeId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setPrintError(getApiErrorMessage(cause, "Không thể in phiếu lương."));
    }
  };

  const sendReview = async (message: string) => {
    if (!reviewItem) return;
    const created = await payrollService.requestPayslipReview(reviewItem.runId, message);
    setReviews((current) => [created, ...current]);
  };

  return (
    <section className="space-y-4 p-5">
      <EmployeePayrollReconciliation />
      {loading && <p className="text-sm text-on-surface-variant">Đang tải phiếu lương...</p>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {reviewsError && <p role="alert" className="text-sm text-error">{reviewsError}</p>}
      {printError && <p role="alert" className="text-sm text-error">{printError}</p>}
      <div className="flex items-center justify-between">
        <h2 className="text-balance text-lg font-semibold text-on-surface">Phiếu lương của tôi</h2>
      </div>

      {!loading && !error && (!items.length ? (
        <p className="rounded-lg bg-surface-container-low p-4 text-pretty text-sm text-on-surface-variant">Chưa có phiếu lương nào được phát hành. Vui lòng quay lại sau khi kỳ lương được chốt và phát phiếu.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => {
            const review = reviews.find((entry) => entry.runId === item.runId);
            return (
            <article
              key={`${item.runId}-${item.employeeId}`}
              className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-on-surface md:text-base">Kỳ lương tháng {item.periodKey}</p>
                <p className="text-sm font-semibold tabular-nums text-on-surface">Thực nhận: {formatVnd(item.netPay)}</p>
                <p className="text-xs tabular-nums text-on-surface-variant">
                  Đã trả {formatVnd(item.paidAmount)} · Còn lại {formatVnd(item.balance)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Xem chi tiết phiếu lương tháng ${item.periodKey}`}
                  title="Xem chi tiết"
                  className="flex size-11 items-center justify-center rounded-lg border border-outline text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    void openDetail(item);
                  }}
                >
                  <Eye size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`In phiếu lương tháng ${item.periodKey}`}
                  title="In phiếu lương"
                  className="flex size-11 items-center justify-center rounded-lg border border-outline text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    void printPayslip(item);
                  }}
                >
                  <Printer size={16} aria-hidden="true" />
                </button>
              </div>
              </div>
              {review && (
                <div className="rounded-lg bg-surface-container-low p-3 text-sm text-on-surface">
                  <p className="font-medium">{review.status === "open" ? "Đang chờ kiểm tra lại lương" : "Đã phản hồi yêu cầu kiểm tra lại"}</p>
                  <p className="mt-1 whitespace-pre-wrap text-pretty text-on-surface-variant">Nội dung: {review.message}</p>
                  {review.response && <p className="mt-2 whitespace-pre-wrap text-pretty">Phản hồi: {review.response}</p>}
                </div>
              )}
              <button type="button" disabled={review?.status === "open" || Boolean(reviewsError)} onClick={() => setReviewItem(item)} className="min-h-11 self-start rounded-lg border border-outline px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">
                {review?.status === "open" ? "Đang chờ phản hồi" : "Yêu cầu kiểm tra lại lương"}
              </button>
            </article>
            );
          })}
        </div>
      ))}

      {reviews.some((review) => !items.some((item) => item.runId === review.runId)) && (
        <section aria-labelledby="previous-payroll-reviews" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <h3 id="previous-payroll-reviews" className="text-balance text-base font-semibold text-on-surface">Yêu cầu của các phiếu lương trước</h3>
          <ul className="mt-3 divide-y divide-outline-variant">
            {reviews.filter((review) => !items.some((item) => item.runId === review.runId)).map((review) => (
              <li key={review.id} className="py-3 text-sm first:pt-0 last:pb-0">
                <p className="font-medium text-on-surface">Kỳ {review.periodKey} · {review.status === "open" ? "Đang chờ phản hồi" : "Đã phản hồi"}</p>
                <p className="mt-1 whitespace-pre-wrap text-pretty text-on-surface-variant">Nội dung: {review.message}</p>
                {review.response && <p className="mt-2 whitespace-pre-wrap text-pretty text-on-surface">Phản hồi: {review.response}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {selectedItem && (
        <dialog ref={detailDialogRef} aria-label="Chi tiết phiếu lương" onCancel={(event) => { event.preventDefault(); setSelectedItem(null); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 text-on-surface shadow-lg backdrop:bg-inverse-surface/55">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Chi tiết phiếu lương</h3>
                <p className="text-xs text-slate-500">Kỳ {selectedItem.periodKey} · {selectedItem.employeeName || selectedItem.employeeId}</p>
              </div>
              <button type="button" aria-label="Đóng chi tiết phiếu lương" onClick={() => setSelectedItem(null)} className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary"><X size={17} aria-hidden="true" /></button>
            </div>

            {detailError ? (
              <p role="alert" className="py-6 text-sm text-error">{detailError}</p>
            ) : detailLoading ? (
              <p className="text-sm text-cyan-700 animate-pulse text-center py-8">Đang tải thông tin chi tiết...</p>
            ) : (
              (() => {
                const detail = buildPayrollDetails(selectedItem.attendance, selectedItem.calculation, selectedItem.vietnam);
                const money = formatVnd;
                return (
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-4">
                      <div>
                        <span className="text-xs text-slate-500">Lương cơ bản</span>
                        <b className="block">{money(detail.monthlySalary)}</b>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Đơn giá giờ</span>
                        <b className="block">{money(Math.round(detail.hourlyRate))}</b>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Công chuẩn</span>
                        <b className="block">{detail.standardDays.toFixed(2)} ngày</b>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500">Công thực tế</span>
                        <b className="block">{detail.workedDays.toFixed(2)} ngày</b>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-slate-500">Thiếu công</span>
                        <b className="block text-rose-600">
                          {detail.shortageDays.toFixed(2)} ngày ({detail.shortageMinutes.toLocaleString()} phút)
                        </b>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Thu nhập & Phụ cấp</p>
                      <div className="flex justify-between">
                        <span>Lương theo công</span>
                        <b>{money(detail.adjustedBase)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Tăng ca</span>
                        <b>{money(detail.overtimeValue)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Phụ cấp</span>
                        <b>{money(detail.allowances)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Thưởng</span>
                        <b>{money(detail.bonuses)}</b>
                      </div>
                      <div className="flex justify-between border-t pt-2 font-bold">
                        <span>Tổng thu nhập (Gross)</span>
                        <b className="text-slate-900">{money(detail.gross)}</b>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Chi tiết khấu trừ</p>
                      <div className="flex justify-between">
                        <span>BHXH</span>
                        <b className="text-rose-600">-{money(detail.deductionBreakdown.socialInsurance)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>BHYT</span>
                        <b className="text-rose-600">-{money(detail.deductionBreakdown.healthInsurance)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>BHTN</span>
                        <b className="text-rose-600">-{money(detail.deductionBreakdown.unemploymentInsurance)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Thuế TNCN</span>
                        <b className="text-rose-600">-{money(detail.deductionBreakdown.personalIncomeTax)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Khấu trừ khác</span>
                        <b className="text-rose-600">-{money(detail.deductionBreakdown.otherDeductions)}</b>
                      </div>
                      <div className="flex justify-between">
                        <span>Tạm ứng</span>
                        <b className="text-rose-600">-{money(detail.deductionBreakdown.advances)}</b>
                      </div>
                      <div className="flex justify-between border-t pt-2 font-bold">
                        <span>Tổng khấu trừ</span>
                        <b className="text-rose-600">-{money(detail.deductionBreakdown.total)}</b>
                      </div>
                      <div className="flex justify-between border-t pt-2 text-base font-bold text-slate-900">
                        <span>Thực nhận (Net)</span>
                        <b className="text-cyan-700">{money(detail.net)}</b>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
        </dialog>
      )}
      {reviewItem && <PayslipReviewMessageDialog title="Yêu cầu kiểm tra lại lương" description={`Phiếu lương kỳ ${reviewItem.periodKey}. Người phụ trách bảng lương sẽ xem và phản hồi yêu cầu của bạn.`} label="Nội dung cần kiểm tra" submitLabel="Gửi yêu cầu" maxLength={2000} onClose={() => setReviewItem(null)} onSubmit={sendReview} />}
    </section>
  );
}
