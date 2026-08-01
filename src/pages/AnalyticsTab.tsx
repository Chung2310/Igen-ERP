import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Loader2 } from "lucide-react";
import { analyticsService, type AnalyticsMeta } from "../services/analyticsService";

/**
 * Trang Phân tích & Báo cáo — chỉ admin/superadmin (gate ở route-config + API).
 *
 * Giai đoạn 1 mới dựng khung và hiển thị tình trạng sẵn sàng của từng nguồn
 * doanh thu. Các biểu đồ được bổ sung ở giai đoạn 2 trở đi.
 * Xem docs/admin-analytics/research.md.
 */
export default function AnalyticsTab() {
  const [meta, setMeta] = useState<AnalyticsMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    analyticsService
      .getMeta()
      .then((data) => {
        if (!cancelled) setMeta(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Phân tích &amp; Báo cáo</h1>
            <p className="text-sm text-slate-500">
              Tổng hợp doanh thu, công nợ và chi phí toàn công ty. Khu vực dành riêng cho quản trị viên.
            </p>
          </div>
        </div>
      </header>

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-[28px] border border-slate-200 bg-white p-10 text-sm font-semibold text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang kiểm tra dữ liệu báo cáo...
        </div>
      )}

      {error && (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {meta && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
            Nguồn doanh thu
          </h2>

          <ul className="space-y-3">
            {meta.sources.map((source) => (
              <li
                key={source.key}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4"
              >
                {source.available ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{source.label}</p>
                  {source.available ? (
                    <p className="text-sm text-slate-500">Sẵn sàng đưa vào báo cáo.</p>
                  ) : (
                    <>
                      <p className="text-sm text-amber-700">{source.blockedReason}</p>
                      {Boolean(source.excludedRecords) && (
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {source.excludedRecords} phiếu chưa được tính vào doanh thu.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">
            Biểu đồ doanh thu, công nợ và chi phí sẽ được bổ sung ở các giai đoạn tiếp theo. Nguồn dữ
            liệu chưa đủ điều kiện sẽ bị loại khỏi báo cáo thay vì hiển thị số 0, để tránh đọc nhầm
            “chưa có dữ liệu” thành “không có doanh thu”.
          </p>
        </section>
      )}
    </div>
  );
}
