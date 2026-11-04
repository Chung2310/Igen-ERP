import React, { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { toast } from "../../pages/Toast";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { DateInput24, TimeInput24 } from "../common/TimeInput24";
import { StyledSelect } from "../common/StyledSelect";
import { HrPageTitle } from "../hr/HrPageTitle";

interface WorkHoursConfig {
  useCustom: boolean;
  checkInLimit?: string;
  checkOutLimit?: string;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
  workingDays?: number[];
  annualLeaveDays?: number;
  employmentStatus?: "official" | "probation" | "internship";
  officialDate?: string;
}

interface EmployeeRow {
  _id: string;
  displayName?: string;
  fullName?: string;
  email?: string;
  role?: string;
  workHoursConfig?: WorkHoursConfig;
  employmentStatus?: "official" | "probation" | "internship";
  officialDate?: string;
}

const DAY_OPTIONS = [
  { day: 1, label: "T2" },
  { day: 2, label: "T3" },
  { day: 3, label: "T4" },
  { day: 4, label: "T5" },
  { day: 5, label: "T6" },
  { day: 6, label: "T7" },
  { day: 0, label: "CN" },
];

const DEFAULT_CONFIG: WorkHoursConfig = {
  useCustom: false,
  checkInLimit: "08:30",
  checkOutLimit: "17:30",
  lunchBreakStart: "12:00",
  lunchBreakEnd: "13:00",
  workingDays: [1, 2, 3, 4, 5],
  annualLeaveDays: undefined,
  employmentStatus: "official",
  officialDate: "",
};

const inputClass =
  "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none";

const employeeName = (employee: EmployeeRow) => {
  const email = employee.email?.trim().toLowerCase();
  return [employee.displayName, employee.fullName]
    .map((name) => name?.trim())
    .find((name) => name && name.toLowerCase() !== email) || "";
};

export default function EmployeeWorkHoursTab() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [form, setForm] = useState<WorkHoursConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await fetch("/api/v1/timekeeping/work-hours", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        });
        const result = await res.json();
        if (res.ok) {
          setEmployees(Array.isArray(result.data) ? result.data : []);
        } else {
          toast.error(result.message || "Không tải được danh sách nhân viên.");
        }
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Lỗi kết nối khi tải danh sách nhân viên."));
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  const openEdit = (emp: EmployeeRow) => {
    setEditing(emp);
    setForm({ ...DEFAULT_CONFIG, ...(emp.workHoursConfig || {}), employmentStatus: emp.employmentStatus || emp.workHoursConfig?.employmentStatus || "official", officialDate: emp.officialDate || emp.workHoursConfig?.officialDate || "" });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (form.useCustom && (!form.workingDays || form.workingDays.length === 0)) {
      toast.error("Vui lòng chọn ít nhất một ngày làm việc.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/timekeeping/work-hours/${editing._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success("Cập nhật giờ làm việc thành công!");
        setEmployees((current) =>
          current.map((emp) => (emp._id === editing._id ? { ...emp, workHoursConfig: result.data?.workHoursConfig || form } : emp))
        );
        setEditing(null);
      } else {
        const joiErrors = result.errors ? Object.values(result.errors).flat().join(" ") : "";
        toast.error(joiErrors || result.message || "Cập nhật thất bại.");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Lỗi kết nối khi lưu giờ làm việc."));
    } finally {
      setSaving(false);
    }
  };

  const keyword = search.trim().toLowerCase();
  const filtered = keyword
    ? employees.filter(
        (emp) =>
          employeeName(emp).toLowerCase().includes(keyword) ||
          (emp.email || "").toLowerCase().includes(keyword)
      )
    : employees;

  return (
    <div className="space-y-4 text-left text-on-surface">
      <div className="border-b border-outline-variant pb-3">
        <HrPageTitle level={3}>Giờ làm việc riêng của nhân viên</HrPageTitle>
      </div>
      <div className="relative">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
        <input
          type="text"
          aria-label="Tìm nhân viên theo tên hoặc email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc email..."
          className="min-h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-2 pl-9 pr-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>

      {loading ? (
        <p className="text-xs text-gray-500 py-6 text-center">Đang tải danh sách nhân viên...</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-500 py-6 text-center">Không có nhân viên nào.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl">
          <table className="w-full min-w-2xl text-sm">
            <thead className="bg-surface-container-low text-on-surface">
              <tr>
                <th scope="col" className="p-3 text-left font-medium">Nhân viên</th>
                <th scope="col" className="p-3 text-left font-medium">Email</th>
                <th scope="col" className="p-3 text-left font-medium">Giờ làm việc</th>
                <th scope="col" className="p-3 text-left font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
          {filtered.map((emp) => {
            const custom = emp.workHoursConfig?.useCustom;
            const name = employeeName(emp);
            return (
              <tr key={emp._id} className="border-b border-outline-variant last:border-b-0 hover:bg-surface-container-low">
                <td className="p-3 font-medium">{name || "Chưa có tên"}</td>
                <td className="p-3 text-on-surface-variant">{emp.email || "—"}</td>
                <td className="p-3">
                  <span className="rounded-full bg-surface-container-low px-2 py-1">
                    {custom ? "Giờ riêng" : "Theo công ty"}
                  </span>
                  {custom && (
                    <span className="ml-2 whitespace-nowrap tabular-nums text-on-surface-variant">
                      {emp.workHoursConfig?.checkInLimit} – {emp.workHoursConfig?.checkOutLimit}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => openEdit(emp)}
                    aria-label={`Chỉnh sửa giờ làm việc của ${name || emp.email || "nhân viên"}`}
                    className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    Chỉnh sửa
                  </button>
                </td>
              </tr>
            );
          })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4 max-h-[90dvh] overflow-y-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="text-left">
                <h4 className="text-base font-semibold text-on-surface text-balance">Giờ làm việc riêng</h4>
                <p className="text-xs text-on-surface-variant">{employeeName(editing) || editing.email}</p>
              </div>
              <button type="button" aria-label="Đóng" onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 cursor-pointer">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-on-surface">Dùng giờ làm việc riêng</span>
              <input
                type="checkbox"
                checked={form.useCustom}
                onChange={(e) => setForm((f) => ({ ...f, useCustom: e.target.checked }))}
                className="h-4 w-4 accent-indigo-600"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-on-surface-variant">Trạng thái nhân sự</label>
                <StyledSelect appearance="erp" ariaLabel="Trạng thái nhân sự" value={form.employmentStatus || "official"} onChange={(employmentStatus) => setForm((f) => ({ ...f, employmentStatus: employmentStatus as WorkHoursConfig["employmentStatus"] }))} options={[{ value: "official", label: "Chính thức" }, { value: "probation", label: "Thử việc" }, { value: "internship", label: "Thực tập" }]} />
              </div>
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-on-surface-variant">Ngày chính thức</label>
                <DateInput24 ariaLabel="Ngày chính thức" value={form.officialDate || ""} onChange={(officialDate) => setForm((f) => ({ ...f, officialDate }))} />
              </div>
              <div className="space-y-1.5 text-left col-span-2">
                <label htmlFor="employee-annual-leave-days" className="block text-xs font-medium text-on-surface-variant">Phép năm tùy chỉnh (để trống: theo công ty)</label>
                <input id="employee-annual-leave-days" type="number" min="0" value={form.annualLeaveDays ?? ""} onChange={(e) => setForm((f) => ({ ...f, annualLeaveDays: e.target.value === "" ? undefined : Number(e.target.value) }))} className={inputClass} />
              </div>
            </div>

            {!form.useCustom && (
              <p className="text-[10px] text-gray-500 text-left">Nhân viên này đang áp dụng giờ làm việc chung của công ty.</p>
            )}

            {form.useCustom && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-medium text-on-surface-variant">Giờ vào (check-in)</label>
                  <TimeInput24 ariaLabel="Giờ vào (Check-in)" variant="compact" className="w-full" value={form.checkInLimit || ""} onChange={(value) => setForm((f) => ({ ...f, checkInLimit: value }))} />
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-medium text-on-surface-variant">Giờ ra (check-out)</label>
                  <TimeInput24 ariaLabel="Giờ ra (Check-out)" variant="compact" className="w-full" value={form.checkOutLimit || ""} onChange={(value) => setForm((f) => ({ ...f, checkOutLimit: value }))} />
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-medium text-on-surface-variant">Bắt đầu nghỉ trưa</label>
                  <TimeInput24 ariaLabel="Bắt đầu nghỉ trưa" variant="compact" className="w-full" value={form.lunchBreakStart || ""} onChange={(value) => setForm((f) => ({ ...f, lunchBreakStart: value }))} />
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-medium text-on-surface-variant">Kết thúc nghỉ trưa</label>
                  <TimeInput24 ariaLabel="Kết thúc nghỉ trưa" variant="compact" className="w-full" value={form.lunchBreakEnd || ""} onChange={(value) => setForm((f) => ({ ...f, lunchBreakEnd: value }))} />
                </div>
                <div className="col-span-2 space-y-2 text-left">
                  <label className="block text-xs font-medium text-on-surface-variant">Ngày làm việc</label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_OPTIONS.map(({ day, label }) => (
                      <label key={day} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(form.workingDays || []).includes(day)}
                          onChange={() =>
                            setForm((f) => ({
                              ...f,
                              workingDays: (f.workingDays || []).includes(day)
                                ? (f.workingDays || []).filter((value) => value !== day)
                                : [...(f.workingDays || []), day],
                            }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={saving}
                className="px-4 py-2 border border-outline-variant hover:bg-surface-container rounded-xl text-xs font-medium text-on-surface transition cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-primary hover:opacity-90 text-on-primary rounded-xl text-xs font-medium transition shadow-sm active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
