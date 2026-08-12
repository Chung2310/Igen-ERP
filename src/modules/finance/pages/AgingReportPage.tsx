import { useEffect, useState } from "react";
import {
  financeReceivablesApi,
  type AgingBucket,
} from "../api/financeReceivables.api";
const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const buckets: Array<{ key: AgingBucket; label: string }> = [
  { key: "0-30", label: "0–30 ngày" },
  { key: "31-60", label: "31–60 ngày" },
  { key: "61-90", label: "61–90 ngày" },
  { key: "over90", label: "Trên 90 ngày" },
];
export default function AgingReportPage({
  onDrillDown,
}: {
  onDrillDown: (bucket: AgingBucket) => void;
}) {
  const [data, setData] = useState<
    Record<string, { count: number; balance: number }>
  >({});
  const [error, setError] = useState("");
  useEffect(() => {
    financeReceivablesApi
      .aging()
      .then(setData)
      .catch((reason) =>
        setError(
          reason instanceof Error ? reason.message : "Không tải được tuổi nợ.",
        ),
      );
  }, []);
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Phân tích tuổi nợ</h1>
        <p className="text-sm text-slate-500">
          Chọn một nhóm để xem các khoản công nợ tương ứng.
        </p>
      </div>
      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {buckets.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-label={`Xem nhóm ${label}`}
            onClick={() => onDrillDown(key)}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-cyan-400"
          >
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {money.format(data[key]?.balance || 0)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {data[key]?.count || 0} khoản
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
