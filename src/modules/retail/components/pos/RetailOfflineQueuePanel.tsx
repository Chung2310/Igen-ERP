import type { RetailOfflineOrder } from "../../offline/retailOfflineQueue";
const labels: Record<string, string> = {
  pending: "Chờ đồng bộ",
  syncing: "Đang đồng bộ",
  failed: "Đồng bộ lỗi",
  synced: "Đã đồng bộ",
  revoked: "Đã thu hồi",
};
export default function RetailOfflineQueuePanel({
  items,
  onRetry,
  onRemove,
  onReconcile,
  onRevoke,
}: {
  items: RetailOfflineOrder[];
  onRetry(id: string): void;
  onRemove(id: string): void;
  onReconcile?(id: string): void;
  onRevoke?(id: string): void;
}) {
  if (!items.length) return null;
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <h2 className="font-bold text-amber-900">
        Yêu cầu thanh toán ({items.length})
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
            <p className="mt-1 text-slate-600">
              Giao dịch bán hàng
              {Number.isSafeInteger((item.payload as any)?.expectedGrandTotal) && " · Tổng: " + new Intl.NumberFormat("vi-VN").format((item.payload as any).expectedGrandTotal) + " đ"}
            </p>
            {item.lastError && (
              <p role="alert" className="mt-1 text-error">{item.lastError}</p>
            )}
            <div className="mt-2 flex gap-3">
              {item.status !== "synced" && item.status !== "revoked" && (
                <button
                  aria-label={`Thử lại ${item.id}`}
                  onClick={() => onRetry(item.id)}
                  className="font-semibold text-[#0758d5]"
                >
                  Thử lại
                </button>
              )}
              {item.status !== "synced" && item.status !== "revoked" && <>
                {onReconcile && <button aria-label={`Đối chiếu ${item.id}`} onClick={() => onReconcile(item.id)} className="font-semibold text-[#0758d5]">Đối chiếu</button>}
                {onRevoke && <button aria-label={`Thu hồi ${item.id}`} onClick={() => onRevoke(item.id)} className="text-red-700">Thu hồi yêu cầu</button>}
              </>}
              {item.status === "synced" && <button
                aria-label={`Xóa ${item.id}`}
                onClick={() => onRemove(item.id)}
                className="text-slate-600"
              >
                Xóa
              </button>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
