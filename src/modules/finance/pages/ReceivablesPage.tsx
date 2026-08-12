import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Pagination } from "../../../components/common/Pagination";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import {
  financeReceivablesApi,
  type AgingBucket,
  type FinanceReceivable,
  type ReceivableStatus,
} from "../api/financeReceivables.api";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const validAging = new Set(["0-30", "31-60", "61-90", "over90"]);

export default function ReceivablesPage({
  permissions,
  onOpen,
}: {
  permissions: readonly string[];
  onOpen?: (id: string) => void;
}) {
  const params = new URLSearchParams(window.location.search);
  const agingParam = params.get("aging");
  const customerId = params.get("customerId") || undefined;
  const agingBucket = validAging.has(String(agingParam))
    ? (agingParam as AgingBucket)
    : undefined;
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [status, setStatus] = useState<ReceivableStatus | "">("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    items: FinanceReceivable[];
    total: number;
  }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(
        await financeReceivablesApi.list({
          page,
          limit: 20,
          status: status || undefined,
          customerId,
          agingBucket,
        }),
      );
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không tải được công nợ.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, status, customerId, agingBucket, debounced]);
  useEffect(() => {
    void load();
  }, [load]);
  const items = debounced
    ? result.items.filter((item) =>
        `${item.receivableCode} ${item.customerName}`
          .toLocaleLowerCase("vi")
          .includes(debounced.toLocaleLowerCase("vi")),
      )
    : result.items;
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Công nợ phải thu</h1>
        <p className="text-sm text-slate-500">
          Theo dõi số dư, hạn trả và lịch sử từng khoản.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Tìm công nợ"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm"
            placeholder="Tìm mã hoặc khách hàng"
          />
        </label>
        <select
          aria-label="Lọc trạng thái"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ReceivableStatus | "");
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="open">Đang mở</option>
          <option value="partially_paid">Đã thu một phần</option>
          <option value="settled">Đã tất toán</option>
          <option value="written_off">Đã xóa nợ</option>
        </select>
      </div>
      {agingBucket && (
        <p className="rounded-xl bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800">
          Đang lọc nhóm tuổi nợ: {agingBucket}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}
      {loading ? (
        <p className="p-6 text-center text-sm text-slate-500">
          Đang tải công nợ...
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Mã</th>
                  <th className="p-3">Khách hàng</th>
                  <th className="p-3">Hạn trả</th>
                  <th className="p-3">Quá hạn</th>
                  <th className="p-3 text-right">Còn nợ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item._id}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    onClick={() => onOpen?.(item._id)}
                  >
                    <td className="p-3 font-semibold text-cyan-700">
                      {item.receivableCode}
                    </td>
                    <td className="p-3">{item.customerName}</td>
                    <td className="p-3">
                      {new Date(item.dueDate).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="p-3">
                      {item.daysOverdue > 0 ? (
                        <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                          Quá hạn {item.daysOverdue} ngày
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-right font-bold">
                      {money.format(item.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && (
              <p className="p-6 text-center text-sm text-slate-500">
                Chưa có khoản công nợ phù hợp.
              </p>
            )}
          </div>
        </div>
      )}
      <Pagination
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(result.total / 20))}
        onPageChange={setPage}
      />
    </section>
  );
}
