import type { RetailReport } from "../../types";

type RetailReportTablesProps = { report: RetailReport };

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("vi-VN");

function formatDate(value?: string): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function shiftStatus(status: string): string {
  return ({ open: "Đang mở", closed: "Đã đóng", reconciled: "Đã đối soát" } as Record<string, string>)[status] || status;
}

const headingClass = "whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500";
const cellClass = "whitespace-nowrap px-4 py-3 text-sm text-slate-700";

export default function RetailReportTables({ report }: RetailReportTablesProps) {
  const rangeLabel = `${formatDate(report.range.from)} – ${formatDate(report.range.to)}`;
  const productTable = (title: string, rows: RetailReport["products"]) => <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-4 py-4"><h2 className="font-bold text-slate-900">{title}</h2><p className="text-sm text-slate-500">{rangeLabel}</p></div><div className="overflow-x-auto"><table aria-label={title} className="w-full min-w-[760px]"><thead className="bg-slate-50"><tr><th className={headingClass}>SKU</th><th className={headingClass}>Sản phẩm</th><th className={headingClass}>Danh mục</th><th className={headingClass}>Thương hiệu</th><th className={`${headingClass} text-right`}>Số lượng</th><th className={`${headingClass} text-right`}>Doanh thu</th>{rows.some((row) => row.profit !== undefined) && <th className={`${headingClass} text-right`}>Lợi nhuận</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.productId}><td className={cellClass}>{row.sku}</td><td className={cellClass}>{row.productName}</td><td className={cellClass}>{row.category || "—"}</td><td className={cellClass}>{row.brand || "—"}</td><td className={`${cellClass} text-right`}>{numberFormatter.format(row.netQuantity)}</td><td className={`${cellClass} text-right`}>{moneyFormatter.format(row.netSales)}</td>{row.profit !== undefined && <td className={`${cellClass} text-right`}>{moneyFormatter.format(row.profit)}</td>}</tr>)}</tbody></table></div></article>;
  return (
    <section className="space-y-4">
      {report.analyticsReconciliation && <article className={`rounded-2xl border p-4 ${report.analyticsReconciliation.matched ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><h2 className="font-bold">Chênh lệch Retail – Analytics</h2><div className="mt-2 grid gap-2 text-sm sm:grid-cols-3"><span>Retail: <b>{moneyFormatter.format(report.analyticsReconciliation.retailNetSales)}</b></span><span>Analytics: <b>{moneyFormatter.format(report.analyticsReconciliation.analyticsNetSales)}</b></span><span>Chênh lệch: <b>{moneyFormatter.format(report.analyticsReconciliation.difference)}</b></span></div></article>}
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <h2 className="font-bold text-slate-900">Hiệu suất thu ngân</h2>
          <p className="text-sm text-slate-500">Kết quả bán hàng theo người tạo đơn</p>
        </div>
        <div className="overflow-x-auto">
          <table aria-label="Hiệu suất thu ngân" className="w-full min-w-[760px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={headingClass}>Thu ngân</th>
                <th className={`${headingClass} text-right`}>Số đơn</th>
                <th className={`${headingClass} text-right`}>Doanh thu gộp</th>
                <th className={`${headingClass} text-right`}>Hoàn tiền</th>
                <th className={`${headingClass} text-right`}>Doanh thu thuần</th>
                <th className={`${headingClass} text-right`}>Trung bình đơn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.cashiers.length > 0 ? report.cashiers.map((cashier) => (
                <tr key={cashier.cashierId}>
                  <td className={`${cellClass} font-semibold text-slate-900`}>{cashier.cashierName}</td>
                  <td className={`${cellClass} text-right`}>{numberFormatter.format(cashier.orderCount)}</td>
                  <td className={`${cellClass} text-right`}>{moneyFormatter.format(cashier.grossSales)}</td>
                  <td className={`${cellClass} text-right text-rose-600`}>{moneyFormatter.format(cashier.refunds)}</td>
                  <td className={`${cellClass} text-right font-semibold`}>{moneyFormatter.format(cashier.netSales)}</td>
                  <td className={`${cellClass} text-right`}>{moneyFormatter.format(cashier.averageOrderValue)}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">Chưa có dữ liệu thu ngân trong khoảng này.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <h2 className="font-bold text-slate-900">Ca bán hàng</h2>
          <p className="text-sm text-slate-500">Doanh số và đối soát theo ca</p>
        </div>
        <div className="overflow-x-auto">
          <table aria-label="Ca bán hàng" className="w-full min-w-[960px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={headingClass}>Mã ca</th>
                <th className={headingClass}>Ngày</th>
                <th className={headingClass}>Thu ngân</th>
                <th className={headingClass}>Trạng thái</th>
                <th className={`${headingClass} text-right`}>Doanh thu gộp</th>
                <th className={`${headingClass} text-right`}>Đã thu</th>
                <th className={`${headingClass} text-right`}>Hoàn tiền</th>
                <th className={`${headingClass} text-right`}>Chênh lệch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.shifts.length > 0 ? report.shifts.map((shift) => (
                <tr key={shift.shiftId}>
                  <td className={`${cellClass} font-semibold text-cyan-700`}>{shift.shiftCode}</td>
                  <td className={cellClass}>{formatDate(shift.businessDate)}</td>
                  <td className={`${cellClass} font-semibold text-slate-900`}>{shift.cashierName}</td>
                  <td className={cellClass}><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{shiftStatus(shift.status)}</span></td>
                  <td className={`${cellClass} text-right`}>{moneyFormatter.format(shift.grossSales)}</td>
                  <td className={`${cellClass} text-right`}>{moneyFormatter.format(shift.collectedAmount)}</td>
                  <td className={`${cellClass} text-right text-rose-600`}>{moneyFormatter.format(shift.refundedAmount)}</td>
                  <td className={`${cellClass} text-right font-semibold ${typeof shift.varianceAmount === "number" && shift.varianceAmount !== 0 ? "text-amber-700" : ""}`}>
                    {typeof shift.varianceAmount === "number" ? moneyFormatter.format(shift.varianceAmount) : "—"}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">Chưa có ca bán hàng trong khoảng này.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
          <h2 className="font-bold text-slate-900">Công nợ khách hàng</h2>
          <p className="text-sm text-slate-500">Các khoản còn phải thu tại chi nhánh hiện tại</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Tổng hợp công nợ">
            {[
              ["Tổng công nợ", report.debt.totalDebt, "text-slate-900"],
              ["Nợ quá hạn", report.debt.overdueDebt, "text-rose-700"],
              ["Đến hạn hôm nay", report.debt.dueTodayDebt, "text-amber-700"],
              ["Chưa đến hạn", report.debt.upcomingDebt, "text-emerald-700"],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className={`mt-1 font-bold ${tone}`}>{moneyFormatter.format(Number(value))}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table aria-label="Công nợ khách hàng" className="w-full min-w-[840px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={headingClass}>Khách hàng</th>
                <th className={headingClass}>Điện thoại</th>
                <th className={`${headingClass} text-right`}>Tổng nợ</th>
                <th className={`${headingClass} text-right`}>Quá hạn</th>
                <th className={headingClass}>Hạn gần nhất</th>
                <th className={`${headingClass} text-right`}>Số đơn nợ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.debt.customers.length > 0 ? report.debt.customers.map((customer) => (
                <tr key={customer.customerId}>
                  <td className={`${cellClass} font-semibold text-slate-900`}>{customer.customerName}</td>
                  <td className={cellClass}>{customer.customerPhone || "—"}</td>
                  <td className={`${cellClass} text-right font-semibold`}>{moneyFormatter.format(customer.totalDebt)}</td>
                  <td className={`${cellClass} text-right font-semibold text-rose-700`}>{moneyFormatter.format(customer.overdueDebt)}</td>
                  <td className={cellClass}>{formatDate(customer.nearestDueDate)}</td>
                  <td className={`${cellClass} text-right`}>{numberFormatter.format(customer.orderCount)}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">Không có khách hàng đang nợ trong khoảng này.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
      {productTable("Sản phẩm bán chạy", report.products || [])}
      {productTable("Sản phẩm bán chậm", report.slowProducts || [])}
    </section>
  );
}
