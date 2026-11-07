import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Pagination } from "../../../components/common/Pagination";
import { FinanceEmptyState } from "../components/FinanceEmptyState";
import { StyledSelect } from "../../../components/common/StyledSelect";
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
    <section className="finance-page-content">
      <div>
        <h2 className="text-balance text-sm font-semibold text-on-surface">Công nợ phải thu</h2>
        <p className="text-sm text-on-surface-variant">
          Theo dõi số dư, hạn trả và lịch sử từng khoản.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            aria-label="Tìm công nợ"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-md border border-outline-variant py-2 pl-10 pr-3 text-sm"
            placeholder="Tìm mã hoặc khách hàng"
          />
        </label>
        <StyledSelect
          ariaLabel="Lọc trạng thái"
          className="h-9 rounded-md"
          menuClassName="finance-select-menu"
          value={status}
          onChange={(value) => { setStatus(value as ReceivableStatus | ""); setPage(1); }}
          options={[{ value: "", label: "Tất cả trạng thái" }, { value: "open", label: "Đang mở" }, { value: "partially_paid", label: "Đã thu một phần" }, { value: "settled", label: "Đã tất toán" }, { value: "written_off", label: "Đã xóa nợ" }]}
        />
      </div>
      {agingBucket && (
        <p className="rounded-md bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container">
          Đang lọc nhóm tuổi nợ: {agingBucket}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-error-container p-4 text-sm text-on-error-container">{error}</p>
      )}
      {loading ? (
        <p className="p-4 text-center text-sm text-on-surface-variant">
          Đang tải công nợ...
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-outline-variant bg-surface-container-lowest">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-container-low text-on-surface-variant">
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
                  <tr key={item._id} className="border-t border-outline-variant hover:bg-surface-container-low">
                    <td className="p-3 font-semibold text-on-primary-container">
                      <button type="button" onClick={() => onOpen?.(item._id)} className="text-left hover:underline focus-visible:outline-2 focus-visible:outline-primary" aria-label={`Xem công nợ ${item.receivableCode}`}>
                        {item.receivableCode}
                      </button>
                    </td>
                    <td className="p-3">{item.customerName}</td>
                    <td className="p-3">
                      {new Date(item.dueDate).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="p-3">
                      {item.daysOverdue > 0 ? (
                        <span className="rounded-full bg-error-container px-2 py-1 text-xs font-bold text-on-error-container">
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
              <FinanceEmptyState kind="search">Chưa có khoản công nợ phù hợp.</FinanceEmptyState>
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
