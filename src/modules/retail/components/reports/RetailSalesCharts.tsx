import type { RetailReport } from "../../types";

type RetailSalesChartsProps = { report: RetailReport };

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const compactMoneyFormatter = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const paymentLabels: Record<RetailReport["paymentMix"][number]["method"], string> = {
  cash: "Tiền mặt",
  card: "Thẻ",
  transfer: "Chuyển khoản",
  ewallet: "Ví điện tử",
};

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function linePath(values: number[], maxValue: number): string {
  const width = 700;
  const height = 170;
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = 10 + height - (Math.max(0, value) / maxValue) * height;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export default function RetailSalesCharts({ report }: RetailSalesChartsProps) {
  const trendMaximum = Math.max(1, ...report.timeSeries.flatMap((row) => [row.grossSales, row.netSales, row.collectedAmount, row.refunds]));
  const paymentMaximum = Math.max(1, ...report.paymentMix.map((row) => row.amount));
  const firstDay = report.timeSeries[0]?.businessDate || report.range.from;
  const lastDay = report.timeSeries.at(-1)?.businessDate || report.range.to;

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Xu hướng doanh thu</h2>
            <p className="text-sm text-slate-500">{formatDate(report.range.from)} – {formatDate(report.range.to)}</p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600" aria-label="Chú giải biểu đồ">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />Doanh thu thuần</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Đã thu</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" />Hoàn tiền</span>
          </div>
        </div>

        {report.timeSeries.length > 0 ? (
          <div className="min-w-0">
            <svg
              role="img"
              aria-label="Xu hướng doanh thu theo ngày"
              viewBox="0 0 700 210"
              preserveAspectRatio="none"
              className="h-64 w-full overflow-visible"
            >
              <title>Xu hướng doanh thu theo ngày</title>
              {[10, 52.5, 95, 137.5, 180].map((y) => (
                <line key={y} x1="0" x2="700" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              ))}
              <path d={linePath(report.timeSeries.map((row) => row.netSales), trendMaximum)} fill="none" stroke="#06b6d4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <path d={linePath(report.timeSeries.map((row) => row.collectedAmount), trendMaximum)} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <path d={linePath(report.timeSeries.map((row) => row.refunds), trendMaximum)} fill="none" stroke="#fb7185" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{formatDate(firstDay)}</span>
              <span className="font-semibold text-slate-600">Cao nhất: {compactMoneyFormatter.format(trendMaximum)} ₫</span>
              <span>{formatDate(lastDay)}</span>
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">Chưa có dữ liệu xu hướng trong khoảng này.</div>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-bold text-slate-900">Cơ cấu thanh toán</h2>
        <p className="text-sm text-slate-500">Giá trị thực nhận theo phương thức</p>
        {report.paymentMix.length > 0 ? (
          <div className="mt-5 space-y-5">
            {report.paymentMix.map((row) => (
              <div key={row.method}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-700">{paymentLabels[row.method]}</span>
                  <span className="font-bold text-slate-900">{moneyFormatter.format(row.amount)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    style={{ width: `${Math.max(0, Math.min(100, (row.amount / paymentMaximum) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 flex h-52 items-center justify-center rounded-xl bg-slate-50 text-center text-sm text-slate-500">Chưa có thanh toán trong khoảng này.</div>
        )}
      </article>
    </section>
  );
}
