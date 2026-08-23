import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { marketingApi, type MarketingDelivery } from "../api/marketing.api";
import { toast } from "../../../pages/Toast";

const TYPE_LABEL: Record<string, string> = {
  thank_you: "Cảm ơn",
  birthday: "Sinh nhật",
  holiday: "Lễ tết",
  remarketing: "Remarketing",
};

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
  skipped: "bg-slate-100 text-slate-500",
  sending: "bg-amber-50 text-amber-700",
  queued: "bg-slate-100 text-slate-500",
};

export default function MarketingDeliveriesPage({ canManage }: { canManage: boolean }) {
  const [deliveries, setDeliveries] = useState<MarketingDelivery[]>([]);
  const [automationType, setAutomationType] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDeliveries(await marketingApi.listDeliveries({ automationType, status, limit: 100 }));
    } catch (err: any) {
      toast.error(err?.message || "Không tải được nhật ký gửi.");
    } finally {
      setLoading(false);
    }
  }, [automationType, status]);

  useEffect(() => { void load(); }, [load]);

  const retry = async (delivery: MarketingDelivery) => {
    await marketingApi.retryDelivery(delivery._id);
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={automationType} onChange={(event) => setAutomationType(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">Tất cả loại tin</option>
          {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">Tất cả trạng thái</option>
          <option value="sent">Đã gửi</option>
          <option value="failed">Lỗi</option>
          <option value="skipped">Bỏ qua</option>
        </select>
        <button type="button" onClick={load} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Tải lại</button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Thời điểm</th>
                <th className="px-3 py-2">Loại</th>
                <th className="px-3 py-2">Khách hàng</th>
                <th className="px-3 py-2">Kênh · Địa chỉ</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Chưa có tin nào được gửi.</td></tr>
              )}
              {deliveries.map((delivery) => (
                <tr key={delivery._id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-xs text-slate-500">{new Date(delivery.createdAt).toLocaleString("vi-VN")}</td>
                  <td className="px-3 py-2">{TYPE_LABEL[delivery.automationType] || delivery.automationType}</td>
                  <td className="px-3 py-2">{delivery.customerName || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{delivery.channel} · {delivery.recipient}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[delivery.status] || "bg-slate-100"}`}>{delivery.status}</span>
                    {delivery.error && <p className="mt-1 max-w-xs truncate text-[11px] text-rose-500" title={delivery.error}>{delivery.error}</p>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canManage && delivery.status === "failed" && delivery.attempt < delivery.maxAttempts && (
                      <button type="button" onClick={() => retry(delivery)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        <RotateCcw className="h-3.5 w-3.5" /> Gửi lại
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
