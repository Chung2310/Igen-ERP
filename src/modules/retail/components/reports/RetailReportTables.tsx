import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Package,
  Phone,
  Receipt,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
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

const headingClass =
  "whitespace-nowrap px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500";
const cellClass = "whitespace-nowrap px-4 py-3.5 text-xs text-slate-700";

export default function RetailReportTables({ report }: RetailReportTablesProps) {
  const [productTab, setProductTab] = useState<"top" | "slow">("top");
  const rangeLabel = `${formatDate(report.range.from)} – ${formatDate(report.range.to)}`;

  const renderProductTable = (title: string, rows: RetailReport["products"]) => {
    return (
      <div className="overflow-x-auto">
        <table aria-label={title} className="w-full">
          <thead className="bg-slate-50/75 border-b border-slate-100">
            <tr>
              <th className="w-12 px-4 py-3 text-center text-[11px] font-bold text-slate-400">#</th>
              <th className={headingClass}>SKU</th>
              <th className={headingClass}>Sản phẩm</th>
              <th className={headingClass}>Danh mục</th>
              <th className={headingClass}>Thương hiệu</th>
              <th className={`${headingClass} text-right`}>Số lượng</th>
              <th className={`${headingClass} text-right`}>Doanh thu</th>
              {rows.some((row) => row.profit !== undefined) && (
                <th className={`${headingClass} text-right`}>Lợi nhuận</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <tr key={row.productId} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-4 py-3.5 text-center text-xs font-bold text-slate-400">
                    {index === 0 ? (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-black text-amber-800">
                        1
                      </span>
                    ) : index === 1 ? (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-black text-slate-700">
                        2
                      </span>
                    ) : index === 2 ? (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-50 text-[10px] font-black text-amber-700">
                        3
                      </span>
                    ) : (
                      index + 1
                    )}
                  </td>
                  <td className={cellClass}>
                    <span className="font-mono text-[11px] font-bold rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                      {row.sku}
                    </span>
                  </td>
                  <td className={`${cellClass} font-semibold text-slate-900`}>
                    {row.productName}
                  </td>
                  <td className={cellClass}>{row.category || "—"}</td>
                  <td className={cellClass}>{row.brand || "—"}</td>
                  <td className={`${cellClass} text-right font-semibold`}>
                    {numberFormatter.format(row.netQuantity)}
                  </td>
                  <td className={`${cellClass} text-right font-bold text-slate-900`}>
                    {moneyFormatter.format(row.netSales)}
                  </td>
                  {row.profit !== undefined && (
                    <td className={`${cellClass} text-right font-semibold text-emerald-700`}>
                      {moneyFormatter.format(row.profit)}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-400">
                  Chưa có dữ liệu sản phẩm trong khoảng này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <section className="space-y-5">
      {/* Analytics Reconciliation Banner */}
      {report.analyticsReconciliation && (
        <article
          className={`rounded-3xl border p-4.5 transition-all ${
            report.analyticsReconciliation.matched
              ? "border-emerald-200 bg-emerald-50/70"
              : "border-amber-200 bg-amber-50/70"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              {report.analyticsReconciliation.matched ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              )}
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Chênh lệch Retail – Analytics
                </h2>
                <p className="text-[11px] text-slate-500">
                  {report.analyticsReconciliation.matched
                    ? "Dữ liệu doanh thu bán hàng và báo cáo tổng hợp hoàn toàn khớp."
                    : "Phát hiện chênh lệch giữa ghi nhận bán hàng và báo cáo phân tích."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-xl bg-white px-3 py-1.5 shadow-xs border border-slate-200/60">
                Retail: <strong className="text-slate-900">{moneyFormatter.format(report.analyticsReconciliation.retailNetSales)}</strong>
              </span>
              <span className="rounded-xl bg-white px-3 py-1.5 shadow-xs border border-slate-200/60">
                Analytics: <strong className="text-slate-900">{moneyFormatter.format(report.analyticsReconciliation.analyticsNetSales)}</strong>
              </span>
              <span
                className={`rounded-xl px-3 py-1.5 font-bold shadow-xs ${
                  report.analyticsReconciliation.matched
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-600 text-white"
                }`}
              >
                Chênh lệch: {moneyFormatter.format(report.analyticsReconciliation.difference)}
              </span>
            </div>
          </div>
        </article>
      )}

      {/* Cashier Performance Table */}
      <article className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs transition hover:border-slate-300">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Hiệu suất thu ngân</h2>
              <p className="text-xs text-slate-500">Kết quả bán hàng chi tiết theo người tạo đơn</p>
            </div>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            {report.cashiers.length} nhân viên
          </span>
        </div>

        <div className="overflow-x-auto">
          <table aria-label="Hiệu suất thu ngân" className="w-full min-w-[760px]">
            <thead className="bg-slate-50/75 border-b border-slate-100">
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
              {report.cashiers.length > 0 ? (
                report.cashiers.map((cashier) => (
                  <tr key={cashier.cashierId} className="transition-colors hover:bg-slate-50/60">
                    <td className={`${cellClass} font-semibold text-slate-900 flex items-center gap-2`}>
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-cyan-800 text-[10px] font-bold">
                        {cashier.cashierName.slice(0, 1)}
                      </div>
                      {cashier.cashierName}
                    </td>
                    <td className={`${cellClass} text-right font-medium`}>
                      {numberFormatter.format(cashier.orderCount)}
                    </td>
                    <td className={`${cellClass} text-right`}>
                      {moneyFormatter.format(cashier.grossSales)}
                    </td>
                    <td className={`${cellClass} text-right text-rose-600 font-medium`}>
                      {moneyFormatter.format(cashier.refunds)}
                    </td>
                    <td className={`${cellClass} text-right font-bold text-slate-900`}>
                      {moneyFormatter.format(cashier.netSales)}
                    </td>
                    <td className={`${cellClass} text-right font-medium text-slate-600`}>
                      {moneyFormatter.format(cashier.averageOrderValue)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">
                    Chưa có dữ liệu thu ngân trong khoảng này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* Customer Debt Table */}
      <article className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs transition hover:border-slate-300">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Công nợ khách hàng</h2>
                <p className="text-xs text-slate-500">Các khoản còn phải thu tại chi nhánh hiện tại</p>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {report.debt.customers.length} khách nợ
            </span>
          </div>

          {/* 4 Debt Summary KPI Cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Tổng hợp công nợ">
            {[
              {
                label: "Tổng công nợ",
                value: report.debt.totalDebt,
                tone: "text-slate-900",
                bg: "bg-slate-50",
                border: "border-slate-200/80",
                icon: Receipt,
                iconColor: "text-slate-600",
              },
              {
                label: "Nợ quá hạn",
                value: report.debt.overdueDebt,
                tone: "text-rose-700",
                bg: "bg-rose-50/50",
                border: "border-rose-200",
                icon: AlertTriangle,
                iconColor: "text-rose-600",
              },
              {
                label: "Đến hạn hôm nay",
                value: report.debt.dueTodayDebt,
                tone: "text-amber-700",
                bg: "bg-amber-50/50",
                border: "border-amber-200",
                icon: Clock,
                iconColor: "text-amber-600",
              },
              {
                label: "Chưa đến hạn",
                value: report.debt.upcomingDebt,
                tone: "text-emerald-700",
                bg: "bg-emerald-50/50",
                border: "border-emerald-200",
                icon: CheckCircle2,
                iconColor: "text-emerald-600",
              },
            ].map(({ label, value, tone, bg, border, icon: Icon, iconColor }) => (
              <div
                key={label}
                className={`rounded-2xl border p-3.5 transition ${bg} ${border}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {label}
                  </span>
                  <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
                <p className={`text-base font-black tracking-tight ${tone}`}>
                  {moneyFormatter.format(Number(value))}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table aria-label="Công nợ khách hàng" className="w-full min-w-[840px]">
            <thead className="bg-slate-50/75 border-b border-slate-100">
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
              {report.debt.customers.length > 0 ? (
                report.debt.customers.map((customer) => (
                  <tr key={customer.customerId} className="transition-colors hover:bg-slate-50/60">
                    <td className={`${cellClass} font-semibold text-slate-900`}>
                      {customer.customerName}
                    </td>
                    <td className={cellClass}>
                      {customer.customerPhone ? (
                        <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {customer.customerPhone}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${cellClass} text-right font-bold text-slate-900`}>
                      {moneyFormatter.format(customer.totalDebt)}
                    </td>
                    <td className={`${cellClass} text-right font-bold text-rose-700`}>
                      {customer.overdueDebt > 0 ? (
                        <span className="inline-block rounded-md bg-rose-50 px-2 py-0.5 border border-rose-200">
                          {moneyFormatter.format(customer.overdueDebt)}
                        </span>
                      ) : (
                        "0 ₫"
                      )}
                    </td>
                    <td className={cellClass}>{formatDate(customer.nearestDueDate)}</td>
                    <td className={`${cellClass} text-right font-medium`}>
                      {numberFormatter.format(customer.orderCount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">
                    Không có khách hàng đang nợ trong khoảng này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {/* Top & Slow Products - Full Width with Toggle Tabs */}
      <article className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs transition hover:border-slate-300">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                productTab === "top"
                  ? "text-cyan-600 bg-cyan-50"
                  : "text-amber-600 bg-amber-50"
              }`}
            >
              {productTab === "top" ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  {productTab === "top" ? "Sản phẩm bán chạy" : "Sản phẩm bán chậm"}
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                  {productTab === "top"
                    ? `${(report.products || []).length} mặt hàng`
                    : `${(report.slowProducts || []).length} mặt hàng`}
                </span>
              </div>
              <p className="text-xs text-slate-500">{rangeLabel}</p>
            </div>
          </div>

          {/* Toggle Tabs */}
          <div className="flex items-center gap-1.5 rounded-2xl bg-slate-100/90 p-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setProductTab("top")}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                productTab === "top"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <TrendingUp className={`h-3.5 w-3.5 ${productTab === "top" ? "text-cyan-600" : "text-slate-400"}`} />
              <span>Sản phẩm bán chạy</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  productTab === "top"
                    ? "bg-cyan-50 text-cyan-700"
                    : "bg-slate-200/60 text-slate-600"
                }`}
              >
                {(report.products || []).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProductTab("slow")}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                productTab === "slow"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <TrendingDown className={`h-3.5 w-3.5 ${productTab === "slow" ? "text-amber-600" : "text-slate-400"}`} />
              <span>Sản phẩm bán chậm</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  productTab === "slow"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-200/60 text-slate-600"
                }`}
              >
                {(report.slowProducts || []).length}
              </span>
            </button>
          </div>
        </div>

        {/* Product Tables */}
        <div className={productTab === "top" ? "block" : "hidden"}>
          {renderProductTable("Sản phẩm bán chạy", report.products || [])}
        </div>
        <div className={productTab === "slow" ? "block" : "hidden"}>
          <span className="sr-only">{rangeLabel}</span>
          {renderProductTable("Sản phẩm bán chậm", report.slowProducts || [])}
        </div>
      </article>
    </section>
  );
}
