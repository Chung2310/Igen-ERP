import type { RetailOfflineOrder } from "../../offline/retailOfflineQueue";
const labels: Record<string, string> = {
  pending: "Chờ đồng bộ",
  syncing: "Đang đồng bộ",
  failed: "Đồng bộ lỗi",
  synced: "Đã đồng bộ",
};
export default function RetailOfflineQueuePanel({
  items,
  onRetry,
  onRemove,
}: {
  items: RetailOfflineOrder[];
  onRetry(id: string): void;
  onRemove(id: string): void;
}) {
  if (!items.length) return null;
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <h2 className="font-bold text-amber-900">
        Đơn hàng offline ({items.length})
      </h2>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg bg-white p-2 text-sm">
            <div className="flex justify-between">
              <span>{labels[item.status]}</span>
              <span>
                {new Date(item.createdAt).toLocaleTimeString("vi-VN")}
              </span>
            </div>
            {item.lastError && (
              <p className="mt-1 text-red-700">{item.lastError}</p>
            )}
            <div className="mt-2 flex gap-3">
              {item.status === "failed" && (
                <button
                  aria-label={`Thử lại ${item.id}`}
                  onClick={() => onRetry(item.id)}
                  className="font-semibold text-cyan-700"
                >
                  Thử lại
                </button>
              )}
              <button
                aria-label={`Xóa ${item.id}`}
                onClick={() => onRemove(item.id)}
                className="text-slate-600"
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
