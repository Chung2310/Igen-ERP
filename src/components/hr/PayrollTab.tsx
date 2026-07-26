import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, FileSpreadsheet, Inbox, Lock, Play, RefreshCw, Search, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { payrollService } from "../../services/payrollService";

type SortDir = "asc" | "desc";

function EmptyState({ icon: Icon, title, hint }: { icon: typeof Inbox; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <Icon size={28} className="text-slate-300" />
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {hint && <p className="text-xs text-slate-400 max-w-sm">{hint}</p>}
    </div>
  );
}

function SortHeader({ label, sortKey, activeKey, dir, onSort, align = "left" }: { label: string; sortKey: string; activeKey: string; dir: SortDir; onSort: (key: string) => void; align?: "left" | "right" | "center" }) {
  const isActive = activeKey === sortKey;
  const Icon = isActive ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`p-3 font-semibold text-slate-500 cursor-pointer select-none whitespace-nowrap ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {label}
        <Icon size={12} className={isActive ? "text-slate-600" : "text-slate-300"} />
      </span>
    </th>
  );
}

const STEPS = [
  { key: "synced", label: "Đồng bộ công" },
  { key: "locked", label: "Khóa công" },
  { key: "calculated", label: "Tính lương" },
  { key: "approved", label: "Duyệt" },
  { key: "closed", label: "Chốt kỳ" },
] as const;

export default function PayrollTab({ canManage }: { canManage: boolean }) {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [run, setRun] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("employeeName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const reload = async () => { try { setRun(await payrollService.getRun(period)); } catch { setRun(null); } try { setResults(await payrollService.getResults(period)); } catch { setResults([]); } };
  useEffect(() => { void reload(); }, [period]);
  useEffect(() => { setSearch(""); setSortKey("employeeName"); setSortDir("asc"); }, [period]);

  const exportCsv = () => { const rows = run?.lines || results; const csv = ["employeeId,adjustedBase,overtime,net", ...rows.map((line: any) => [line.employeeId, line.calculation?.adjustedBase || "", line.calculation?.overtime || "", line.calculation?.net || ""].join(","))].join("\\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `payroll-${period}.csv`; anchor.click(); URL.revokeObjectURL(url); };
  const exportExcel = () => {
    const rows = run
      ? run.lines.map((line: any) => {
          const originalResult = results.find((r) => r.employeeId === line.employeeId);
          return {
            "Mã nhân viên": line.employeeId,
            "Tên nhân viên": line.employeeName || originalResult?.employeeName || "",
            "Lương cơ bản": originalResult?.monthlySalary || line.calculation?.monthlySalary || 0,
            "Lương điều chỉnh": line.calculation?.adjustedBase || 0,
            "Tăng ca": line.calculation?.overtime || 0,
            "Thực nhận": line.calculation?.net || 0,
          };
        })
      : results.map((row: any) => ({
          "Mã nhân viên": row.employeeId,
          "Tên nhân viên": row.employeeName || "",
          "Lương cơ bản": row.monthlySalary || 0,
          "Công chuẩn (giờ)": row.standardHours,
          "Thiếu công (ngày)": Number(row.shortageDays ?? ((row.shortageMinutes || 0) / 480)).toFixed(2),
          "Nghỉ phép (phút)": row.paidLeaveMinutesByRate?.reduce((sum: number, item: any) => sum + (item.minutes || 0), 0) || 0,
          "Trạng thái công": row.status === "locked" ? "Đã khóa" : "Bản nháp",
        }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BangLuong");
    XLSX.writeFile(workbook, `bang-luong-${period}.xlsx`);
  };
  const action = async (fn: () => Promise<unknown>, success: string) => { try { await fn(); setMessage(success); await reload(); } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể thực hiện thao tác"); } };

  const allLocked = results.length > 0 && results.every((r) => r.status === "locked");
  const currentStepIndex = run?.status === "closed" ? 4
    : run?.status === "approved" ? 3
    : run ? 2
    : allLocked ? 1
    : results.length > 0 ? 0
    : -1;

  const runRows = useMemo(() => {
    if (!run) return [];
    return run.lines.map((line: any) => {
      const originalResult = results.find((r: any) => r.employeeId === line.employeeId);
      return {
        employeeId: line.employeeId,
        employeeName: line.employeeName || originalResult?.employeeName || "",
        baseSalary: originalResult?.monthlySalary || line.calculation?.monthlySalary || 0,
        adjustedBase: line.calculation?.adjustedBase || 0,
        overtime: line.calculation?.overtime || 0,
        net: line.calculation?.net || 0,
      };
    });
  }, [run, results]);

  const draftRows = useMemo(() => results.map((row: any) => ({
    employeeId: row.employeeId,
    employeeName: row.employeeName || "",
    monthlySalary: row.monthlySalary || 0,
    standardHours: row.standardHours,
    shortageDays: Number(row.shortageDays ?? ((row.shortageMinutes || 0) / 480)),
    paidLeaveMinutes: row.paidLeaveMinutesByRate?.reduce((sum: number, item: any) => sum + (item.minutes || 0), 0) || 0,
    status: row.status,
  })), [results]);

  const filteredSortedRunRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term ? runRows.filter((r: any) => r.employeeName.toLowerCase().includes(term) || r.employeeId.toLowerCase().includes(term)) : runRows;
    const sorted = [...filtered].sort((a: any, b: any) => {
      const va = a[sortKey]; const vb = b[sortKey];
      const cmp = typeof va === "string" ? va.localeCompare(vb) : (va || 0) - (vb || 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [runRows, search, sortKey, sortDir]);

  const filteredSortedDraftRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term ? draftRows.filter((r: any) => r.employeeName.toLowerCase().includes(term) || r.employeeId.toLowerCase().includes(term)) : draftRows;
    const sorted = [...filtered].sort((a: any, b: any) => {
      const va = a[sortKey]; const vb = b[sortKey];
      const cmp = typeof va === "string" ? va.localeCompare(vb) : (va || 0) - (vb || 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [draftRows, search, sortKey, sortDir]);

  const onSort = (key: string) => { if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortKey(key); setSortDir("asc"); } };

  const totalNet = runRows.reduce((sum: number, r: any) => sum + r.net, 0);
  const totalBase = runRows.reduce((sum: number, r: any) => sum + r.baseSalary, 0);
  const headcount = run ? runRows.length : draftRows.length;
  const shortageCount = draftRows.filter((r: any) => r.shortageDays > 0).length;

  const canSeeTable = canManage || !!run;

  return <section className="flex-1 overflow-auto p-5 space-y-4 bg-slate-50">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Bảng lương</h2>
        <p className="text-xs text-slate-500">Kỳ lương và kết quả công đã khóa</p>
      </div>
      <div className="flex items-center gap-2">
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        <button title="Tải lại" onClick={() => void reload()} className="rounded-lg border bg-white p-2 cursor-pointer hover:bg-slate-50"><RefreshCw size={16} /></button>
        <button title="Xuất CSV" onClick={exportCsv} className="rounded-lg border bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">CSV</button>
        {canSeeTable && (
          <button title="Xuất Excel" onClick={exportExcel} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
            <FileSpreadsheet size={16} className="text-emerald-600" />
            Excel
          </button>
        )}
      </div>
    </div>

    {message && <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-800">{message}</div>}

    {/* Quy trình xử lý kỳ lương */}
    <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
      <div className="flex items-center min-w-max">
        {STEPS.map((step, index) => {
          const done = index <= currentStepIndex;
          const isLast = index === STEPS.length - 1;
          return (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5 w-24">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  done ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-300 text-slate-400"
                }`}>
                  {done ? <CheckCircle2 size={16} /> : index + 1}
                </div>
                <span className={`text-[11px] text-center font-medium ${done ? "text-emerald-700" : "text-slate-400"}`}>{step.label}</span>
              </div>
              {!isLast && <div className={`h-0.5 w-8 -mt-4 ${index < currentStepIndex ? "bg-emerald-400" : "bg-slate-200"}`} />}
            </div>
          );
        })}
      </div>
    </div>

    {/* Thẻ tổng quan */}
    {canSeeTable && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">{run ? "Tổng thực nhận" : "Tổng lương cơ bản"}</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{(run ? totalNet : draftRows.reduce((s: number, r: any) => s + r.monthlySalary, 0)).toLocaleString()} đ</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">Số nhân viên</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{headcount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">Người thiếu công</p>
          <p className="mt-1 text-lg font-bold text-rose-600">{shortageCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500 font-medium">Tổng lương cơ bản</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{(run ? totalBase : draftRows.reduce((s: number, r: any) => s + r.monthlySalary, 0)).toLocaleString()} đ</p>
        </div>
      </div>
    )}

    {canManage && (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void action(() => payrollService.snapshot(period), "Đã đồng bộ kết quả công")} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-indigo-700">
            <RefreshCw size={15} /> Đồng bộ công
          </button>
          <button onClick={() => void action(() => payrollService.lock(period), "Đã khóa kết quả công")} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white cursor-pointer hover:bg-slate-850">
            <Lock size={15} /> Khóa công
          </button>
          <button onClick={() => void action(() => payrollService.createRun(period), "Đã tạo bảng lương")} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-cyan-700">
            <Play size={15} /> Tính lương
          </button>
          <button onClick={() => void action(() => payrollService.approve(period), "Đã duyệt bảng lương")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-emerald-700">
            <CheckCircle2 size={15} /> Duyệt
          </button>
          <button onClick={() => void action(() => payrollService.close(period), "Đã chốt kỳ lương")} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-indigo-700">
            Chốt kỳ
          </button>
        </div>
        <button onClick={() => { if (window.confirm("Xoa toan bo ky luong de tinh lai tu dau?")) void action(() => payrollService.reset(period), "Da xoa ky luong"); }} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 cursor-pointer hover:bg-rose-100">
          <Trash2 size={15} /> Xóa kỳ lương
        </button>
      </div>
    )}

    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap justify-between gap-3 text-sm items-center">
        <span className="text-slate-500 font-medium">Trạng thái kỳ lương:</span>
        <div className="flex items-center gap-3">
          {canSeeTable && (
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc mã..."
                className="rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs w-52"
              />
            </div>
          )}
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
            run?.status === "approved" || run?.status === "closed" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
            run?.status === "calculated" ? "bg-cyan-100 text-cyan-800 border border-cyan-200" : "bg-slate-100 text-slate-700 border border-slate-200"
          }`}>
            {run?.status === "approved" ? "Đã duyệt" : run?.status === "closed" ? "Đã chốt" : run?.status === "calculated" ? "Đã tính lương" : "Chưa tạo"}
          </span>
        </div>
      </div>

      <div className="overflow-auto border border-slate-100 rounded-xl max-h-[60vh]">
        <table className="w-full text-left text-sm border-collapse">
          {run ? (
            <>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b text-xs text-slate-500">
                  <SortHeader label="Nhân viên" sortKey="employeeName" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                  <SortHeader label="Lương cơ bản" sortKey="baseSalary" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                  <SortHeader label="Lương điều chỉnh" sortKey="adjustedBase" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                  <SortHeader label="Tăng ca" sortKey="overtime" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                  <SortHeader label="Thực nhận" sortKey="net" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {filteredSortedRunRows.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState icon={Search} title="Không tìm thấy nhân viên phù hợp" /></td></tr>
                ) : filteredSortedRunRows.map((line: any) => (
                  <tr key={line.employeeId} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3 font-medium text-slate-700"><div>{line.employeeName || "Chưa có tên"}</div><div className="text-[10px] text-slate-400">{line.employeeId}</div></td>
                    <td className="p-3 text-right text-slate-600">{Number(line.baseSalary).toLocaleString()} đ</td>
                    <td className="p-3 text-right text-slate-600">{Number(line.adjustedBase).toLocaleString()} đ</td>
                    <td className="p-3 text-right text-slate-600">{Number(line.overtime).toLocaleString()} đ</td>
                    <td className="p-3 text-right font-bold text-slate-900">{Number(line.net).toLocaleString()} đ</td>
                  </tr>
                ))}
              </tbody>
              {filteredSortedRunRows.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-slate-50 font-bold text-slate-700">
                    <td className="p-3">Tổng cộng ({filteredSortedRunRows.length})</td>
                    <td className="p-3 text-right">{filteredSortedRunRows.reduce((s: number, r: any) => s + r.baseSalary, 0).toLocaleString()} đ</td>
                    <td className="p-3 text-right">{filteredSortedRunRows.reduce((s: number, r: any) => s + r.adjustedBase, 0).toLocaleString()} đ</td>
                    <td className="p-3 text-right">{filteredSortedRunRows.reduce((s: number, r: any) => s + r.overtime, 0).toLocaleString()} đ</td>
                    <td className="p-3 text-right text-slate-900">{filteredSortedRunRows.reduce((s: number, r: any) => s + r.net, 0).toLocaleString()} đ</td>
                  </tr>
                </tfoot>
              )}
            </>
          ) : !canManage ? (
            <tbody>
              <tr><td><EmptyState icon={Lock} title="Bảng lương chưa được tính cho kỳ này" hint="Vui lòng chờ người có quyền bắt đầu tính lương." /></td></tr>
            </tbody>
          ) : (
            <>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b text-xs text-slate-500">
                  <SortHeader label="Nhân viên" sortKey="employeeName" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                  <SortHeader label="Lương cơ bản" sortKey="monthlySalary" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
                  <SortHeader label="Công chuẩn (giờ)" sortKey="standardHours" activeKey={sortKey} dir={sortDir} onSort={onSort} align="center" />
                  <SortHeader label="Thiếu công (ngày)" sortKey="shortageDays" activeKey={sortKey} dir={sortDir} onSort={onSort} align="center" />
                  <SortHeader label="Nghỉ phép (phút)" sortKey="paidLeaveMinutes" activeKey={sortKey} dir={sortDir} onSort={onSort} align="center" />
                  <th className="p-3 text-center font-semibold text-slate-500">Trạng thái công</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState icon={Inbox} title="Chưa có dữ liệu công" hint='Vui lòng ấn "Đồng bộ công" để tải danh sách nhân viên.' /></td></tr>
                ) : filteredSortedDraftRows.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState icon={Search} title="Không tìm thấy nhân viên phù hợp" /></td></tr>
                ) : (
                  filteredSortedDraftRows.map((row: any) => (
                    <tr key={row.employeeId} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-700"><div>{row.employeeName || "Chưa có tên"}</div><div className="text-[10px] text-slate-400">{row.employeeId}</div></td>
                      <td className="p-3 text-right text-slate-600">{Number(row.monthlySalary).toLocaleString()} đ</td>
                      <td className="p-3 text-center text-slate-600">{row.standardHours} giờ</td>
                      <td className="p-3 text-center font-semibold text-rose-500">{row.shortageDays.toFixed(2)} ngày</td>
                      <td className="p-3 text-center font-semibold text-indigo-500">{row.paidLeaveMinutes} phút</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          row.status === "locked" ? "bg-slate-100 text-slate-700 border border-slate-200" : "bg-yellow-50 text-yellow-700 border border-yellow-100"
                        }`}>
                          {row.status === "locked" ? "Đã khóa" : "Bản nháp"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  </section>;
}
