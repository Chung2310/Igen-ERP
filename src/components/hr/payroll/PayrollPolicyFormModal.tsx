import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  createDefaultPayrollPolicyForm,
  payrollPolicyFormToDefinition,
  policyDefinitionToForm,
  validatePayrollPolicyForm,
  validatePayrollPolicyStep,
  type FundCode,
  type PayrollPolicyDefinition,
  type PayrollPolicyForm,
  type PayrollPolicyFormErrors,
} from "./payrollPolicyForm";

type Props = {
  mode: "create" | "edit" | "clone";
  initialDefinition?: any;
  saving: boolean;
  onCancel: () => void;
  onSave: (definition: PayrollPolicyDefinition) => void | Promise<void>;
};

const steps = ["Thông tin chung", "Bảo hiểm", "Thuế", "Tăng ca & làm tròn"];
const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700">{label}{children}{error && <span className="mt-1 block text-xs font-normal text-rose-600">{error}</span>}</label>;
}

const numberValue = (value: string) => value === "" ? 0 : Number(value);
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

export function PayrollPolicyFormModal({ mode, initialDefinition, saving, onCancel, onSave }: Props) {
  const initial = useMemo(() => {
    const value = initialDefinition ? policyDefinitionToForm(initialDefinition) : createDefaultPayrollPolicyForm();
    if (mode === "clone") return { ...value, code: `${value.code}-copy`, name: `${value.name} - Bản sao` };
    return value;
  }, [initialDefinition, mode]);
  const [form, setForm] = useState<PayrollPolicyForm>(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<PayrollPolicyFormErrors>({});
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof PayrollPolicyForm>(key: K, value: PayrollPolicyForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const close = () => { if (!dirty || window.confirm("Bạn có thay đổi chưa lưu. Đóng popup?")) onCancel(); };
  const next = () => { const found = validatePayrollPolicyStep(form, step); setErrors(found); if (!Object.keys(found).length) setStep((value) => Math.min(3, value + 1)); };
  const submit = async () => { const found = validatePayrollPolicyForm(form); setErrors(found); if (Object.keys(found).length) { const first = [0, 1, 2, 3].find((index) => Object.keys(validatePayrollPolicyStep(form, index)).length); setStep(first ?? 0); return; } await onSave(payrollPolicyFormToDefinition(form)); };
  const numberInput = (value: number, onChange: (value: number) => void, extra?: string) => <input type="number" min="0" value={value} onChange={(event) => onChange(numberValue(event.target.value))} className={`${inputClass} ${extra ?? ""}`}/>;
  const percentInput = (value: number, onChange: (value: number) => void) => <div className="relative">{numberInput(value, onChange, "pr-9")}<span className="absolute right-3 top-3 text-sm text-slate-400">%</span></div>;

  const general = <div className="grid gap-4 md:grid-cols-2">
    <Field label="Mã công thức" error={errors.code}><input aria-label="Mã công thức" value={form.code} onChange={(e) => set("code", e.target.value)} className={inputClass}/></Field>
    <Field label="Tên công thức" error={errors.name}><input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass}/></Field>
    <Field label="Hiệu lực từ" error={errors.effectiveFrom}><input type="date" value={form.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} className={inputClass}/></Field>
    <Field label="Hiệu lực đến" error={errors.effectiveTo}><input type="date" value={form.effectiveTo} onChange={(e) => set("effectiveTo", e.target.value)} className={inputClass}/></Field>
    <Field label="Lương cơ sở" error={errors.baseSalary}>{numberInput(form.baseSalary, (v) => set("baseSalary", v))}</Field>
    <Field label="Lương tối thiểu vùng" error={errors.regionalMinimumWage}>{numberInput(form.regionalMinimumWage, (v) => set("regionalMinimumWage", v))}</Field>
    <Field label="Hệ số trần BHXH">{numberInput(form.socialCapMultiplier, (v) => set("socialCapMultiplier", v))}</Field>
    <Field label="Hệ số trần BHTN">{numberInput(form.unemploymentCapMultiplier, (v) => set("unemploymentCapMultiplier", v))}</Field>
    <div className="md:col-span-2"><Field label="Nguồn tham chiếu / ghi chú"><textarea value={form.sourceReference} onChange={(e) => set("sourceReference", e.target.value)} rows={2} className={inputClass}/></Field></div>
  </div>;

  const fundNames: Record<FundCode, string> = { social: "Bảo hiểm xã hội", health: "Bảo hiểm y tế", unemployment: "Bảo hiểm thất nghiệp", accident: "Bảo hiểm tai nạn lao động", union: "Kinh phí công đoàn" };
  const insurance = <div className="space-y-4">{(Object.keys(fundNames) as FundCode[]).map((code) => <div key={code} className="rounded-xl border border-slate-200 p-4"><h4 className="mb-3 font-semibold text-slate-800">{fundNames[code]}</h4><div className="grid gap-4 md:grid-cols-2"><Field label="Nhân viên đóng" error={errors[`funds.${code}.employeeRate`]}>{percentInput(form.funds[code].employeeRate, (v) => setForm((current) => ({ ...current, funds: { ...current.funds, [code]: { ...current.funds[code], employeeRate: v } } })))}</Field><Field label="Doanh nghiệp đóng" error={errors[`funds.${code}.employerRate`]}>{percentInput(form.funds[code].employerRate, (v) => setForm((current) => ({ ...current, funds: { ...current.funds, [code]: { ...current.funds[code], employerRate: v } } })))}</Field></div></div>)}</div>;

  const tax = <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2">
    <Field label="Giảm trừ bản thân">{numberInput(form.personalDeduction, (v) => set("personalDeduction", v))}</Field><Field label="Giảm trừ người phụ thuộc">{numberInput(form.dependentDeduction, (v) => set("dependentDeduction", v))}</Field>
    <Field label="Thuế khấu trừ ngắn hạn">{percentInput(form.shortTermWithholdingRate, (v) => set("shortTermWithholdingRate", v))}</Field><Field label="Ngưỡng khấu trừ ngắn hạn">{numberInput(form.shortTermWithholdingThreshold, (v) => set("shortTermWithholdingThreshold", v))}</Field>
    <Field label="Thuế suất không cư trú">{percentInput(form.nonResidentRate, (v) => set("nonResidentRate", v))}</Field>
  </div><div><div className="mb-2 flex items-center justify-between"><h4 className="font-semibold text-slate-800">Bậc thuế lũy tiến</h4><button type="button" onClick={() => set("taxBrackets", [...form.taxBrackets.slice(0, -1), { upTo: "", rate: 0 }, form.taxBrackets.at(-1)!])} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600"><Plus size={15}/>Thêm bậc</button></div>{errors.taxBrackets && <p className="mb-2 text-xs text-rose-600">{errors.taxBrackets}</p>}<div className="space-y-2">{form.taxBrackets.map((bracket, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input aria-label={`Giới hạn bậc ${index + 1}`} type="number" placeholder={index === form.taxBrackets.length - 1 ? "Không giới hạn" : "Thu nhập đến"} value={bracket.upTo} onChange={(e) => set("taxBrackets", form.taxBrackets.map((item, i) => i === index ? { ...item, upTo: e.target.value } : item))} className={inputClass}/>{percentInput(bracket.rate, (v) => set("taxBrackets", form.taxBrackets.map((item, i) => i === index ? { ...item, rate: v } : item)))}<button type="button" disabled={form.taxBrackets.length === 1} onClick={() => set("taxBrackets", form.taxBrackets.filter((_, i) => i !== index))} className="mt-1 rounded-lg px-2 text-rose-500 disabled:opacity-30"><Trash2 size={17}/></button></div>)}</div></div></div>;

  const overtimeLabels: Record<keyof PayrollPolicyForm["overtime"], string> = { weekday: "Ngày thường", restDay: "Ngày nghỉ", holiday: "Ngày lễ", nightPremium: "Phụ cấp ban đêm", nightOvertimeBonus: "Bổ sung tăng ca đêm" };
  const overtime = <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2">{(Object.keys(overtimeLabels) as (keyof PayrollPolicyForm["overtime"])[]).map((key) => <Field key={key} label={`Hệ số ${overtimeLabels[key]}`} error={errors[`overtime.${key}`]}>{numberInput(form.overtime[key], (v) => set("overtime", { ...form.overtime, [key]: v }))}</Field>)}<Field label="Đơn vị làm tròn (VNĐ)" error={errors.roundingUnit}>{numberInput(form.roundingUnit, (v) => set("roundingUnit", v))}</Field></div><div className="rounded-xl bg-indigo-50 p-4 text-sm text-slate-700"><h4 className="mb-2 font-semibold text-indigo-900">Tóm tắt</h4><p>{form.name || "Công thức chưa đặt tên"} · hiệu lực từ {form.effectiveFrom || "chưa chọn"}</p><p>Lương cơ sở {money(form.baseSalary)} · {form.taxBrackets.length} bậc thuế · làm tròn {money(form.roundingUnit)}</p></div></div>;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><div role="dialog" aria-modal="true" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b px-5 py-4"><div><h3 className="font-bold text-slate-900">{mode === "create" ? "Tạo công thức lương" : mode === "clone" ? "Nhân bản công thức lương" : "Sửa công thức lương"}</h3><p className="mt-1 text-xs text-slate-500">Nhập theo từng bước; hệ thống tự tạo cấu hình kỹ thuật khi lưu.</p></div><button aria-label="Đóng" onClick={close} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={19}/></button></header><div className="grid grid-cols-2 gap-2 border-b bg-slate-50 px-5 py-3 md:grid-cols-4">{steps.map((name, index) => <button type="button" key={name} onClick={() => { if (index < step) setStep(index); }} className={`rounded-full px-3 py-2 text-xs font-semibold ${index === step ? "bg-indigo-600 text-white" : index < step ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-500"}`}>{index + 1}. {name}</button>)}</div><main className="min-h-0 flex-1 overflow-y-auto p-5">{step === 0 ? general : step === 1 ? insurance : step === 2 ? tax : overtime}</main><footer className="flex items-center justify-between border-t px-5 py-4"><button type="button" onClick={close} className="rounded-lg border px-4 py-2 text-sm">Hủy</button><div className="flex gap-2">{step > 0 && <button type="button" onClick={() => { setErrors({}); setStep(step - 1); }} className="rounded-lg border px-4 py-2 text-sm">Quay lại</button>}{step < 3 ? <button type="button" onClick={next} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Tiếp tục</button> : <button type="button" disabled={saving} onClick={() => void submit()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu công thức"}</button>}</div></footer></div></div>;
}
