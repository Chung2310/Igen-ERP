import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Inbox,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";
import { payrollService } from "../../../services/payrollService";
import { PAYROLL_RECONCILIATION_FIELDS, type PayrollReconciliation } from "../../../shared/payrollReconciliation";
import { PayrollReconciliationConversation } from "./PayrollReconciliationConversation";

type Status = { runVersion: number; runStatus: string; employeeCount: number; items: PayrollReconciliation[] };
const fieldLabel = (key: string) => PAYROLL_RECONCILIATION_FIELDS.find(field => field.key === key)?.label ?? key;

export function PayrollComplaintsPanel({ runId, runVersion, canManage, hasUnsavedChanges = false, onChanged, onEdit }: {
  runId: string; runVersion: number; canManage: boolean; hasUnsavedChanges?: boolean;
  onChanged: () => void | Promise<void>; onEdit: (employeeId: string, field: string) => void;
}) {
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState("open");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await payrollService.getReconciliation(runId);
      if (id === requestId.current) { setData(result); setError(""); }
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : "Không tải được khiếu nại lương.");
    } finally { if (id === requestId.current) setLoading(false); }
  }, [runId]);

  useEffect(() => { void load(); return () => { requestId.current++; }; }, [load, runVersion]);

  const all = useMemo(() => (data?.items ?? []).flatMap(record => record.issues.map(issue => ({
    key: `${record.employeeId}:${issue.id}`, record, issue,
  }))).sort((a, b) => {
    const priority = Number(a.issue.status === "resolved") - Number(b.issue.status === "resolved");
    return priority || (b.issue.messages.at(-1)?.at ?? "").localeCompare(a.issue.messages.at(-1)?.at ?? "");
  }), [data]);

  const rows = all.filter(({ record, issue }) => (status === "all" || issue.status === status)
    && `${record.employeeName} ${record.employeeId} ${fieldLabel(issue.field)} ${issue.messages.map(message => message.body).join(" ")}`.toLocaleLowerCase("vi-VN").includes(search.trim().toLocaleLowerCase("vi-VN")));

  const active = all.find(row => row.key === selected);
  const openCount = all.filter(row => row.issue.status === "open").length;
  const resolvedCount = all.length - openCount;
  const confirmed = data?.items.filter(record => !record.stale && record.confirmedChecksum === record.snapshot.checksum && !record.issues.some(issue => issue.status === "open")).length ?? 0;
  const totalEmployees = data?.employeeCount ?? 0;
  const confirmPercent = totalEmployees > 0 ? Math.round((confirmed / totalEmployees) * 100) : 0;
  const writable = canManage && data?.runStatus === "draft" && !loading && !publishing && !error;

  const publish = async () => {
    if (!data || !writable || hasUnsavedChanges) return;
    setPublishing(true); setError("");
    try { await payrollService.publishReconciliation(runId, data.runVersion); await load(); await onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "Không phát hành được bảng lương."); }
    finally { setPublishing(false); }
  };

  return (
    <section aria-label="Danh sách khiếu nại lương" className="space-y-4">
      {/* Tiêu đề & Tác vụ */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant/80 bg-surface-container-lowest p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquare size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-on-surface">Khiếu nại & Đối soát của nhân viên</h3>
            <p className="text-xs text-on-surface-variant">
              Tiếp nhận các thắc mắc về công, phụ cấp, hoa hồng, khấu trừ trong kỳ lương và phản hồi trực tiếp tới nhân viên.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loading || publishing}
            onClick={() => void load().then(() => onChanged())}
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface hover:border-slate-300 disabled:opacity-50 cursor-pointer shadow-2xs transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-primary" : "text-on-surface-variant"} />
            Tải lại khiếu nại
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800 shadow-xs">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-sm text-on-surface-variant shadow-xs">
          <RefreshCw size={16} className="animate-spin text-primary" />
          <span>Đang tải khiếu nại lương...</span>
        </div>
      )}

      {data && (
        <>
          {/* Thẻ thống kê KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Chưa giải quyết */}
            <div className="rounded-xl border border-amber-200/70 bg-amber-50 p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800">Chưa giải quyết</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100/80 text-amber-700">
                  <AlertCircle size={15} />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold  text-amber-900">{openCount}</span>
                <span className="text-xs text-amber-700">vấn đề cần xử lý</span>
              </div>
            </div>

            {/* Đã giải quyết */}
            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50 p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800">Đã giải quyết</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-700">
                  <CheckCircle2 size={15} />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold  text-emerald-900">{resolvedCount}</span>
                <span className="text-xs text-emerald-700">khiếu nại đã xong</span>
              </div>
            </div>

            {/* Nhân viên xác nhận */}
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">Nhân viên xác nhận</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <ShieldCheck size={15} />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold  text-on-surface">{confirmed}</span>
                <span className="text-xs text-on-surface-variant font-medium">/ {totalEmployees} nhân sự ({confirmPercent}%)</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-colors" style={{ width: `${Math.min(100, confirmPercent)}%` }} />
              </div>
            </div>

            {/* Tổng số khiếu nại */}
            <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface-variant">Tổng trao đổi</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-on-surface-variant">
                  <Users size={15} />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold  text-on-surface">{all.length}</span>
                <span className="text-xs text-slate-400">luồng đối soát</span>
              </div>
            </div>
          </div>

          {/* Banner thông báo quyền hạn & trạng thái kỳ */}
          {!canManage && (
            <div className="rounded-xl border border-outline-variant bg-surface/80 p-3 text-xs text-on-surface-variant flex items-center gap-2">
              <Users size={14} className="text-slate-400 shrink-0" />
              <span>Bạn đang ở chế độ xem. Cần tài khoản quản lý kỳ lương để trả lời và giải quyết khiếu nại.</span>
            </div>
          )}

          {data.runStatus !== "draft" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800 flex items-center gap-2">
              <Clock size={14} className="text-amber-600 shrink-0" />
              <span>Kỳ lương đã qua bước Nháp. Lịch sử khiếu nại và phản hồi đang ở chế độ lưu trữ chỉ xem.</span>
            </div>
          )}

          {/* Thanh phát hành bảng đối soát */}
          {canManage && data.runStatus === "draft" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/10 p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs">
                <Send size={15} className="text-primary shrink-0" />
                <div>
                  <span className="font-semibold text-on-surface">Phát hành số liệu đối soát cho nhân viên</span>
                  <p className="text-[11px] text-on-surface-variant">
                    Sau khi kế toán điều chỉnh hoặc hoàn tất giải quyết, hãy phát hành bản mới để nhân viên xác nhận.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!writable || publishing || hasUnsavedChanges}
                  onClick={() => void publish()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-on-primary shadow-xs hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <Send size={13} className={publishing ? "animate-spin" : ""} />
                  {publishing ? "Đang phát hành..." : data.items.length ? "Cập nhật bản gửi nhân viên" : "Phát hành bảng lương tạm tính"}
                </button>
                {hasUnsavedChanges && (
                  <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg">
                    Lưu thay đổi trên bảng tính lương trước khi phát hành lại.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Thanh tìm kiếm và bộ lọc */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-outline-variant/80 bg-surface-container-lowest p-3 shadow-xs">
            <div className="relative min-w-[260px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Tìm khiếu nại"
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Tìm nhân viên, mã NV, khoản lương, nội dung..."
                className="w-full rounded-xl border border-outline-variant bg-surface/50 py-1.5 pl-9 pr-3 text-xs text-on-surface outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:bg-surface-container-lowest transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                <Filter size={13} />
                Lọc trạng thái:
              </span>
              <select
                aria-label="Trạng thái khiếu nại"
                value={status}
                onChange={event => setStatus(event.target.value)}
                className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface-variant shadow-2xs outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="open">Chưa giải quyết ({openCount})</option>
                <option value="resolved">Đã giải quyết ({resolvedCount})</option>
                <option value="all">Tất cả ({all.length})</option>
              </select>
            </div>
          </div>

          {/* Bảng danh sách khiếu nại */}
          <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface/90 text-on-surface-variant font-semibold border-b border-outline-variant">
                  <tr>
                    <th className="p-3.5">Nhân viên</th>
                    <th className="p-3.5">Khoản khiếu nại</th>
                    <th className="p-3.5">Nội dung trao đổi</th>
                    <th className="p-3.5">Cập nhật</th>
                    <th className="p-3.5 text-center">Trạng thái</th>
                    <th className="p-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Inbox size={32} className="text-slate-300" />
                          <p className="text-sm font-semibold text-on-surface-variant">
                            {all.length ? "Không tìm thấy khiếu nại phù hợp bộ lọc" : "Chưa có khiếu nại nào trong kỳ lương này"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {all.length ? "Hãy thử thay đổi từ khóa tìm kiếm hoặc chuyển sang xem 'Tất cả'." : "Khi nhân viên có thắc mắc trong phiếu đối soát, các trao đổi sẽ xuất hiện tại đây."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map(({ key, record, issue }) => {
                      const isSelected = selected === key;
                      const isOpen = issue.status === "open";
                      const firstMsg = issue.messages[0]?.body ?? "";
                      const lastDate = issue.messages.at(-1)?.at;

                      return (
                        <tr
                          key={key}
                          className={`transition-colors hover:bg-surface/70 ${isSelected ? "bg-primary/10" : ""}`}
                        >
                          {/* Nhân viên */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-bold text-on-surface-variant text-xs shrink-0">
                                {(record.employeeName || record.employeeId || "NV").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-on-surface block">{record.employeeName || record.employeeId}</span>
                                <span className="font-mono text-[10px] text-slate-400">{record.employeeId}</span>
                              </div>
                            </div>
                          </td>

                          {/* Khoản khiếu nại */}
                          <td className="p-3.5">
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-on-surface-variant w-fit">
                                {fieldLabel(issue.field)}
                              </span>
                              {record.stale && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 w-fit">
                                  Cần phát hành lại
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Nội dung */}
                          <td className="p-3.5 max-w-sm">
                            <p className="line-clamp-2 text-on-surface break-words font-medium">{firstMsg}</p>
                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                              <MessageSquare size={10} />
                              {issue.messages.length} tin nhắn
                            </span>
                          </td>

                          {/* Thời gian */}
                          <td className="p-3.5 whitespace-nowrap text-on-surface-variant text-[11px] font-mono">
                            {lastDate ? new Date(lastDate).toLocaleString("vi-VN") : "—"}
                          </td>

                          {/* Trạng thái */}
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {isOpen ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Chưa giải quyết
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={11} className="text-emerald-600" />
                                Đã giải quyết
                              </span>
                            )}
                          </td>

                          {/* Thao tác */}
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelected(key)}
                              aria-label={`Xem khiếu nại ${record.employeeName || record.employeeId} - ${fieldLabel(issue.field)}`}
                              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-primary text-on-primary shadow-xs"
                                  : isOpen && writable
                                  ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                                  : "text-on-surface-variant hover:bg-slate-100"
                              }`}
                            >
                              {writable && isOpen ? "Xem / xử lý" : "Xem chi tiết"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Khung chi tiết trao đổi khiếu nại */}
          {active && (
            <div className="rounded-2xl border-2 border-primary/30 bg-surface-container-lowest p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-outline-variant pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface text-sm">
                      {active.record.employeeName || active.record.employeeId} · <span className="text-primary">{fieldLabel(active.issue.field)}</span>
                    </h4>
                    <span className="text-[11px] text-slate-400">Mã NV: {active.record.employeeId}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1 text-xs font-semibold text-on-surface-variant hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  <X size={13} />
                  Đóng chi tiết
                </button>
              </div>

              <PayrollReconciliationConversation
                key={active.key}
                record={active.record}
                staff
                issueId={active.issue.id}
                onEdit={writable ? field => onEdit(active.record.employeeId, field) : undefined}
                onAction={writable ? async action => {
                  await payrollService.replyReconciliation(runId, active.record.employeeId, { ...action, expectedVersion: active.record.version });
                  await load();
                  await onChanged();
                } : undefined}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
