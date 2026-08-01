import { useEffect, useState } from "react";
import { Printer, Eye, X } from "lucide-react";
import { payrollService } from "../../services/payrollService";
import { buildPayrollDetails } from "./payrollDetails";

type Payslip = { runId: string; periodKey?: string; employeeId: string; employeeName?: string; netPay: number; paidAmount: number; balance: number };

export default function EmployeePayslips() {
  const [items, setItems] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    void payrollService.getEmployeePayslips()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể tải payslip"))
      .finally(() => setLoading(false));
  }, []);

  const openDetail = async (item: Payslip) => {
    setSelectedItem(item);
    setDetailLoading(true);
    try {
      const detail = await payrollService.getLineDetail(item.runId, item.employeeId);
      setSelectedItem({
        ...item,
        attendance: detail.attendance || {},
        calculation: detail.calculation || {},
        vietnam: detail.vietnam || {}
      });
    } catch {
      // keep basic item
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) return <div className="p-5 text-sm text-slate-500">Đang tải phiếu lương...</div>;
  if (error) return <div className="p-5 text-sm text-rose-600">{error}</div>;

  return (
    <section className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Phiếu lương của tôi</h2>
      </div>

      {!items.length ? (
        <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Chưa có phiếu lương nào được phát hành.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <article
              key={`${item.runId}-${item.employeeId}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => void openDetail(item)}
            >
              <div className="space-y-1">
                <p className="font-semibold text-slate-800 text-sm md:text-base">Kỳ lương tháng {item.periodKey}</p>
                <p className="text-sm font-bold text-cyan-600">Thực nhận: {item.netPay.toLocaleString()} đ</p>
                <p className="text-xs text-slate-400">
                  Đã trả {item.paidAmount.toLocaleString()} đ · Còn lại {item.balance.toLocaleString()} đ
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Xem chi tiết"
                  className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    void openDetail(item);
                  }}
                >
                  <Eye size={16} />
                </button>
                <button
                  type="button"
                  title="In phiếu lương"
                  className="rounded-lg border p-2 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(payrollService.printPayslip(item.runId, item.employeeId), "_blank", "noopener,noreferrer");
                  }}
                >
                  <Printer size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setSelectedItem(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Chi tiết phiếu lương</h3>
                <p className="text-xs text-slate-500">Kỳ {selectedItem.periodKey} · {selectedItem.employeeName || selectedItem.employeeId}</p>
              </div>
              <button onClick={() => setSelectedItem(null)} className="cursor-pointer p-1 rounded-full hover:bg-slate-100"><X size={17} /></button>
            </div>

            {detailLoading ? (
              <p className="text-sm text-cyan-700 animate-pulse text-center py-8">Đang tải thông tin chi tiết...</p>
            ) : (
              (() => {
                const detail = buildPayrollDetails(selectedItem.attendance, selectedItem.calculation, selectedItem.vietnam);
                const money = (value: number) => value.toLocaleString() + " đ";
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
          </div>
        </div>
      )}
    </section>
  );
}