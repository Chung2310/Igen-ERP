import { useEffect, useState } from "react";
import { CheckCircle2, Lock, Play, RefreshCw, Trash2 } from "lucide-react";
import { payrollService } from "../../services/payrollService";

export default function PayrollTab({ canManage }: { canManage: boolean }) {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [run, setRun] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const reload = async () => { try { setRun(await payrollService.getRun(period)); } catch { setRun(null); } try { setResults(await payrollService.getResults(period)); } catch { setResults([]); } };
  useEffect(() => { void reload(); }, [period]);
  const exportCsv = () => { const rows = run?.lines || results; const csv = ["employeeId,adjustedBase,overtime,net", ...rows.map((line: any) => [line.employeeId, line.calculation?.adjustedBase || "", line.calculation?.overtime || "", line.calculation?.net || ""].join(","))].join("\\n"); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `payroll-${period}.csv`; anchor.click(); URL.revokeObjectURL(url); };
  const action = async (fn: () => Promise<unknown>, success: string) => { try { await fn(); setMessage(success); await reload(); } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể thực hiện thao tác"); } };
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
      </div>
    </div>
    
    {message && <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-800">{message}</div>}
    
    <div className="flex flex-wrap gap-2">
      {canManage && <>
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
        <button onClick={() => { if (window.confirm("Xoa toan bo ky luong de tinh lai tu dau?")) void action(() => payrollService.reset(period), "Da xoa ky luong"); }} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-rose-700"><Trash2 size={15} /> Xoa ky luong</button>
        <button onClick={() => void action(() => payrollService.close(period), "Đã chốt kỳ lương")} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white cursor-pointer hover:bg-indigo-700">
          Chốt kỳ
        </button>
      </>}
    </div>
    
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex justify-between text-sm items-center">
        <span className="text-slate-500 font-medium">Trạng thái kỳ lương:</span>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
          run?.status === "approved" || run?.status === "closed" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
          run?.status === "calculated" ? "bg-cyan-100 text-cyan-800 border border-cyan-200" : "bg-slate-100 text-slate-700 border border-slate-200"
        }`}>
          {run?.status === "approved" ? "Đã duyệt" : run?.status === "closed" ? "Đã chốt" : run?.status === "calculated" ? "Đã tính lương" : "Chưa tạo"}
        </span>
      </div>
      
      <div className="overflow-auto border border-slate-100 rounded-xl">
        <table className="w-full text-left text-sm border-collapse">
          {run ? (
            <>
              <thead>
                <tr className="border-b text-xs text-slate-500 bg-slate-50">
                  <th className="p-3 font-semibold text-slate-500">Mã nhân viên</th>
                  <th className="p-3 text-right font-semibold text-slate-500">Lương cơ bản</th>
                  <th className="p-3 text-right font-semibold text-slate-500">Lương điều chỉnh</th>
                  <th className="p-3 text-right font-semibold text-slate-500">Tăng ca</th>
                  <th className="p-3 text-right font-semibold text-cyan-700">Thực nhận</th>
                </tr>
              </thead>
              <tbody>
                {run.lines.map((line: any) => {
                  const originalResult = results.find(r => r.employeeId === line.employeeId);
                  const baseSalary = originalResult?.monthlySalary || line.calculation?.monthlySalary || 0;
                  return (
                    <tr key={line.employeeId} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-700">{line.employeeId}</td>
                      <td className="p-3 text-right text-slate-600">{Number(baseSalary).toLocaleString()} đ</td>
                      <td className="p-3 text-right text-slate-600">{Number(line.calculation?.adjustedBase || 0).toLocaleString()} đ</td>
                      <td className="p-3 text-right text-slate-600">{Number(line.calculation?.overtime || 0).toLocaleString()} đ</td>
                      <td className="p-3 text-right font-bold text-slate-900">{Number(line.calculation?.net || 0).toLocaleString()} đ</td>
                    </tr>
                  );
                })}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr className="border-b text-xs text-slate-500 bg-slate-50">
                  <th className="p-3 font-semibold text-slate-500">Mã nhân viên</th>
                  <th className="p-3 text-right font-semibold text-slate-500">Lương cơ bản</th>
                  <th className="p-3 text-center font-semibold text-slate-500">Công chuẩn (giờ)</th>
                  <th className="p-3 text-center font-semibold text-rose-600">Thiếu hụt (phút)</th>
                  <th className="p-3 text-center font-semibold text-indigo-600">Nghỉ phép (phút)</th>
                  <th className="p-3 text-center font-semibold text-slate-500">Trạng thái công</th>
                </tr>
              </thead>
              <tbody>
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 text-xs italic">
                      Chưa có dữ liệu công. Vui lòng ấn "Đồng bộ công" để tải danh sách nhân viên.
                    </td>
                  </tr>
                ) : (
                  results.map((row: any) => {
                    const totalPaidLeave = row.paidLeaveMinutesByRate?.reduce((sum: number, item: any) => sum + (item.minutes || 0), 0) || 0;
                    return (
                      <tr key={row.employeeId} className="border-b last:border-0 hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-700">{row.employeeId}</td>
                        <td className="p-3 text-right text-slate-600">{Number(row.monthlySalary || 0).toLocaleString()} đ</td>
                        <td className="p-3 text-center text-slate-600">{row.standardHours} giờ</td>
                        <td className="p-3 text-center font-semibold text-rose-500">{row.shortageMinutes || 0} phút</td>
                        <td className="p-3 text-center font-semibold text-indigo-500">{totalPaidLeave} phút</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            row.status === "locked" ? "bg-slate-100 text-slate-700 border border-slate-200" : "bg-yellow-50 text-yellow-700 border border-yellow-100"
                          }`}>
                            {row.status === "locked" ? "Đã khóa" : "Bản nháp"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  </section>;
}
