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
}: {
  items: RetailOfflineOrder[];
  onRetry(id: string): void;
}) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="retail-offline-title" className="rounded-xl border border-tertiary/40 bg-tertiary-container p-3 text-on-tertiary-container">
      <h2 id="retail-offline-title" className="font-bold">
        Giao dịch chờ xử lý ({items.length})
      </h2>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg bg-surface-container-lowest p-2 text-sm text-on-surface">
            <div className="flex justify-between">
              <span aria-live="polite">{labels[item.status]}</span>
              <span>
                {new Date(item.createdAt).toLocaleTimeString("vi-VN")}
              </span>
            </div>
            {item.lastError && (
              <p role="alert" className="mt-1 text-error">{item.lastError}</p>
            )}
            <div className="mt-2 flex gap-3">
              {item.status === "failed" && (
                <button
                  aria-label={`Thử lại ${item.id}`}
                  onClick={() => onRetry(item.id)}
                  className="min-h-10 rounded-lg px-2 font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary"
                >
                  Thử lại
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
