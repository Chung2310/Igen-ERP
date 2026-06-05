import { Search } from "lucide-react";
import { StockLog } from "../../types";

export function StockLogPanel({ searchLog, setSearchLog, stockLogs }: { searchLog: string; setSearchLog: (value: string) => void; stockLogs: StockLog[] }) {
  return (
    <div className="space-y-6" id="stock_transactions_list">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center" id="log_filters_bar">
        <div className="relative w-full sm:w-80">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input type="text" placeholder="Tra cứu phiếu NK, XK, tên sản phẩm..." className="w-full rounded-lg border border-gray-200 bg-slate-50 py-2 pl-9 pr-4 text-xs" value={searchLog} onChange={(event) => setSearchLog(event.target.value)} />
        </div>
        <div className="font-mono text-[10px] text-gray-400">Tổng số phiếu ghi nhận: <strong>{stockLogs.length} phiếu</strong></div>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white shadow-xs" id="log_records_table">
        <div className="overflow-x-auto text-left font-sans text-xs">
          <table className="w-full">
            <thead className="bg-[#0F172A] text-[10px] font-bold uppercase tracking-wider text-slate-100">
              <tr>
                <th className="px-5 py-3">Mã phiếu</th>
                <th className="px-5 py-3">Loại giao dịch</th>
                <th className="px-5 py-3">Sản phẩm tác động</th>
                <th className="px-5 py-3 text-center">Số lượng</th>
                <th className="px-5 py-3">Phụ trách</th>
                <th className="px-5 py-3">Ngày tạo lập</th>
                <th className="px-5 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150">
              {stockLogs.filter((log) => log.id.toLowerCase().includes(searchLog.toLowerCase()) || log.productName.toLowerCase().includes(searchLog.toLowerCase())).map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-4 font-mono font-bold text-slate-800">{log.id}</td>
                  <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 font-mono text-[9px] font-bold uppercase ${log.type === "nhập" ? "border-green-100 bg-green-50 text-green-700" : "border-red-100 bg-red-50 text-red-700"}`}>{log.type === "nhập" ? "Nhập kho" : "Xuất kho"}</span></td>
                  <td className="px-5 py-4"><p className="font-semibold text-gray-800">{log.productName}</p><span className="font-mono text-[10px] text-gray-400">SKU: {log.sku}</span></td>
                  <td className="px-5 py-4 text-center font-mono font-bold text-slate-700">{log.quantity} chiếc</td>
                  <td className="px-5 py-4 font-medium text-gray-600">{log.operatorName}</td>
                  <td className="px-5 py-4 font-mono text-[10px] text-gray-450">{log.createdAt}</td>
                  <td className="px-5 py-4"><span className="rounded-md bg-green-100 px-2 py-0.5 text-[9px] font-bold text-green-850">{log.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
