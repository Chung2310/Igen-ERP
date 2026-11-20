import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3, Pencil, Plus, Users, X } from "lucide-react";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";

type Shift = {
  _id: string;
  code: string;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  workingDays: number[];
  allowedLateMinutes: number;
  allowedEarlyLeaveMinutes: number;
  isDefault: boolean;
  isActive: boolean;
  employeeCount?: number;
  breakPeriods?: { name: string; startTime: string; endTime: string; paid: boolean }[];
};
type Employee = {
  _id: string;
  displayName?: string;
  email: string;
  department?: string;
  assignment?: { shiftId: string; effectiveFrom: string; effectiveTo?: string; daysOfWeek: number[] };
};
const token = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
});
const days = [
  { v: 1, l: "T2" },
  { v: 2, l: "T3" },
  { v: 3, l: "T4" },
  { v: 4, l: "T5" },
  { v: 5, l: "T6" },
  { v: 6, l: "T7" },
  { v: 0, l: "CN" },
];
const blank = {
  code: "",
  name: "",
  color: "#0891b2",
  startTime: "08:00",
  endTime: "17:00",
  lunchStart: "12:00",
  lunchEnd: "13:00",
  workingDays: [1, 2, 3, 4, 5],
  allowedLateMinutes: 0,
  allowedEarlyLeaveMinutes: 0,
  isDefault: false,
  isActive: true,
};
const input =
  "w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition";

export default function WorkShiftsTab() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editing, setEditing] = useState<Shift | null | "new">(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [assignShift, setAssignShift] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const shiftMap = useMemo(() => new Map(shifts.map((s) => [s._id, s])), [shifts]);
  const load = async () => {
    try {
      const [a, b] = await Promise.all([
        fetch("/api/v1/timekeeping/shifts", { headers: token() }),
        fetch("/api/v1/timekeeping/shift-assignments", { headers: token() }),
      ]);
      const ar = await a.json();
      const br = await b.json();
      if (!a.ok || !b.ok) throw new Error(ar.message || br.message);
      setShifts(ar.data || []);
      setEmployees(br.data || []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể tải dữ liệu ca làm việc."));
    }
  };
  useEffect(() => {
    load();
  }, []);
  const open = (shift?: Shift) => {
    setEditing(shift || "new");
    setForm(
      shift
        ? {
          code: shift.code,
          name: shift.name,
          color: shift.color,
          startTime: shift.startTime,
          endTime: shift.endTime,
          lunchStart: shift.breakPeriods?.[0]?.startTime || "",
          lunchEnd: shift.breakPeriods?.[0]?.endTime || "",
          workingDays: shift.workingDays,
          allowedLateMinutes: shift.allowedLateMinutes,
          allowedEarlyLeaveMinutes: shift.allowedEarlyLeaveMinutes,
          isDefault: shift.isDefault,
          isActive: shift.isActive,
        }
        : blank,
    );
  };
  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        crossesMidnight: form.endTime <= form.startTime,
        breakPeriods:
          form.lunchStart && form.lunchEnd
            ? [{ name: "Nghỉ giữa ca", startTime: form.lunchStart, endTime: form.lunchEnd, paid: false }]
            : [],
      };
      const url =
        editing === "new" ? "/api/v1/timekeeping/shifts" : `/api/v1/timekeeping/shifts/${(editing as Shift)._id}`;
      const res = await fetch(url, {
        method: editing === "new" ? "POST" : "PATCH",
        headers: token(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Đã lưu ca làm việc.");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể lưu ca."));
    } finally {
      setSaving(false);
    }
  };
  const assign = async () => {
    if (!selected.length || !assignShift) return toast.error("Hãy chọn nhân viên và ca làm việc.");
    try {
      const shift = shiftMap.get(assignShift)!;
      const res = await fetch("/api/v1/timekeeping/shift-assignments", {
        method: "POST",
        headers: token(),
        body: JSON.stringify({
          employeeIds: selected,
          shiftId: assignShift,
          effectiveFrom,
          daysOfWeek: shift.workingDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(`Đã phân ca cho ${selected.length} nhân viên.`);
      setSelected([]);
      await load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không thể phân ca."));
    }
  };
  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800">Danh mục ca làm việc</h3>
          <p className="text-xs text-gray-500">Quản lý giờ ca, nghỉ giữa ca và độ trễ cho phép.</p>
        </div>
        <button
          onClick={() => open()}
          className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Plus size={15} />
          Thêm ca
        </button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {shifts.map((s) => (
          <div key={s._id} className="border border-slate-200/80 bg-white rounded-2xl p-4 shadow-xs hover:border-cyan-200 transition">
            <div className="flex justify-between">
              <div className="flex gap-2">
                <span className="w-3 h-3 rounded-full mt-1" style={{ background: s.color }} />
                <div>
                  <div className="font-bold text-sm text-slate-800">
                    {s.name} {s.isDefault && <span className="text-[9px] bg-cyan-50 text-cyan-700 font-bold px-1.5 py-0.5 rounded">MẶC ĐỊNH</span>}
                  </div>
                  <div className="text-[10px] text-slate-400">{s.code}</div>
                </div>
              </div>
              <button onClick={() => open(s)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer">
                <Pencil size={14} />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-700">
              <Clock3 size={14} className="text-cyan-600" />
              <b>
                {s.startTime} – {s.endTime}
              </b>
              {s.crossesMidnight && <span className="text-amber-600 font-semibold">(+1 ngày)</span>}
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <Users size={14} />
              {s.employeeCount || 0} nhân viên
            </div>
          </div>
        ))}
      </div>
      {!shifts.length && (
        <div className="border border-dashed border-slate-300 rounded-2xl p-8 text-center text-xs text-slate-500 bg-slate-50/50">
          Chưa có ca làm việc. Giờ chung hiện tại vẫn được áp dụng cho đến khi tạo ca.
        </div>
      )}
      <div className="border-t border-slate-200 pt-5">
        <h3 className="font-bold text-slate-800">Phân ca nhân viên</h3>
        <div className="my-3 flex flex-wrap gap-2">
          <select className={input + " max-w-xs"} value={assignShift} onChange={(e) => setAssignShift(e.target.value)}>
            <option value="">Chọn ca...</option>
            {shifts
              .filter((s) => s.isActive)
              .map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
          </select>
          <input
            type="date"
            className={input + " max-w-40"}
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
          <button onClick={assign} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer">
            Gán cho {selected.length || "nhân viên"}
          </button>
        </div>
        <div className="max-h-72 overflow-auto border rounded-xl divide-y">
          {employees.map((e) => (
            <label key={e._id} className="flex items-center gap-3 p-3 text-xs hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selected.includes(e._id)}
                onChange={() => setSelected((v) => (v.includes(e._id) ? v.filter((x) => x !== e._id) : [...v, e._id]))}
              />
              <span className="flex-1">
                <b>{e.displayName || e.email}</b>
                <span className="text-gray-400 ml-2">{e.department}</span>
              </span>
              <span>
                {e.assignment ? shiftMap.get(e.assignment.shiftId)?.name || "Ca không còn hoạt động" : "Ca mặc định"}
              </span>
            </label>
          ))}
        </div>
      </div>
      {editing &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 w-full max-w-xl space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">{editing === "new" ? "Thêm ca làm việc" : "Chỉnh sửa ca"}</h3>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className={input}
                  placeholder="Mã ca"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
                <input
                  className={input}
                  placeholder="Tên ca"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <label className="text-xs">
                  Giờ bắt đầu
                  <input
                    type="time"
                    className={input}
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  />
                </label>
                <label className="text-xs">
                  Giờ kết thúc
                  <input
                    type="time"
                    className={input}
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  />
                </label>
                <label className="text-xs">
                  Bắt đầu nghỉ
                  <input
                    type="time"
                    className={input}
                    value={form.lunchStart}
                    onChange={(e) => setForm({ ...form, lunchStart: e.target.value })}
                  />
                </label>
                <label className="text-xs">
                  Kết thúc nghỉ
                  <input
                    type="time"
                    className={input}
                    value={form.lunchEnd}
                    onChange={(e) => setForm({ ...form, lunchEnd: e.target.value })}
                  />
                </label>
              </div>
              <div className="flex gap-2">
                {days.map((d) => (
                  <label key={d.v} className="text-xs">
                    <input
                      type="checkbox"
                      checked={form.workingDays.includes(d.v)}
                      onChange={() =>
                        setForm({
                          ...form,
                          workingDays: form.workingDays.includes(d.v)
                            ? form.workingDays.filter((x) => x !== d.v)
                            : [...form.workingDays, d.v],
                        })
                      }
                    />{" "}
                    {d.l}
                  </label>
                ))}
              </div>
              <label className="text-xs flex gap-2">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                Đặt làm ca mặc định
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={saving || !form.code || !form.name || !form.workingDays.length}
                  onClick={save}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Lưu ca"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
