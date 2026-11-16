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
    <section className="finance-page-content">
      <div>
        <h1 className="finance-page-title">Phân tích tuổi nợ</h1>
      </div>
      {error && (
        <p className="rounded-md bg-error-container p-4 text-sm text-on-error-container">{error}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {buckets.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-label={`Xem nhóm ${label}`}
            onClick={() => onDrillDown(key)}
            className="rounded-md border border-outline-variant bg-surface-container-lowest p-5 text-left hover:border-primary"
          >
            <p className="text-sm font-semibold text-on-surface-variant">{label}</p>
            <p className="mt-2 text-2xl font-bold text-on-surface">
              {money.format(data[key]?.balance || 0)}
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              {data[key]?.count || 0} khoản
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
