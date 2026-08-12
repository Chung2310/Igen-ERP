import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useBranch } from "../../../context/BranchContext";
import { retailDebtRemindersApi } from "../api/retailDebtReminders.api";
export default function RetailDebtRemindersPage() {
  const { userProfile } = useAuth(), { activeBranchId } = useBranch(); const scope = { companyCode: String(userProfile?.companyCode || ""), branchId: String(activeBranchId || "") };
  const [runs, setRuns] = useState<any[] | null>(null), [detail, setDetail] = useState<any>(null), [error, setError] = useState("");
  const load = async () => { setError(""); try { setRuns((await retailDebtRemindersApi.listRuns(scope)).items); } catch (e: any) { setError(e.message || "Không tải được"); } };
  useEffect(() => { if (scope.companyCode && scope.branchId) void load(); }, [scope.companyCode, scope.branchId]);
  const open = async (id: string) => setDetail(await retailDebtRemindersApi.getRun(id, scope));
  return <div className="space-y-4"><div className="flex items-center justify-between"><div><h1 className="text-xl font-bold">Nhắc công nợ</h1><p className="text-sm text-slate-500">Lịch sử gửi thông báo và email.</p></div><button type="button" onClick={() => void retailDebtRemindersApi.runNow(scope).then(load)} className="rounded-lg bg-cyan-600 px-4 py-2 text-white">Chạy ngay</button></div>
    {error && <div className="rounded-lg bg-red-50 p-3 text-red-700">{error}</div>}{runs === null && !error ? <div>Đang tải...</div> : runs?.length === 0 ? <div>Chưa có lần chạy nào.</div> : <table className="w-full rounded-xl bg-white text-sm"><thead><tr><th>Ngày</th><th>Trạng thái</th><th>Quá hạn</th><th>Đã gửi</th><th>Lỗi</th></tr></thead><tbody>{runs?.map((item) => <tr key={item._id} onClick={() => void open(item._id)} className="cursor-pointer border-t"><td className="p-3 text-cyan-700">{item.businessDate}</td><td>{item.status}</td><td>{item.overdueOrders}</td><td>{item.sent}</td><td>{item.failed}</td></tr>)}</tbody></table>}
    {detail && <div className="rounded-xl border bg-white p-4"><h2 className="font-bold">Chi tiết delivery</h2>{detail.deliveries.map((item: any) => <div key={item._id} className="mt-2 flex justify-between bg-slate-50 p-3"><span><span>{item.channel}</span> · <span>{item.payload?.to || item.recipientId}</span> · <span>{item.status}</span></span>{item.status === "failed" && item.failureType === "temporary" && item.attempt < item.maxAttempts && <button type="button" onClick={() => void retailDebtRemindersApi.retry(item._id, scope).then(() => open(detail.run._id))} className="text-cyan-700">Thử lại</button>}</div>)}</div>}
  </div>;
}
