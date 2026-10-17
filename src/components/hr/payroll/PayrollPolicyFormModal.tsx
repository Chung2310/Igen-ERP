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
import { PayrollPolicyConfirmDialog } from "./PayrollPolicyConfirmDialog";
import { PayrollDatePicker } from "./PayrollDatePicker";

type Props = {
  mode: "create" | "edit" | "clone";
  initialDefinition?: any;
  saving: boolean;
  onCancel: () => void;
  onSave: (definition: PayrollPolicyDefinition) => void | Promise<void>;
};

const steps = ["Thông tin chung", "Bảo hiểm", "Thuế", "Tăng ca & làm tròn"];
const inputClass = "no-number-spinner mt-1 min-h-10 w-full rounded-xl border border-[#DCE7F4] bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-[#8BDCF9] focus:ring-2 focus:ring-[#00ADFC]/15";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-normal text-slate-700">{label}{children}{error && <span className="mt-1 block text-xs font-normal text-rose-600">{error}</span>}</label>;
}

function DateField({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  return <div className="text-sm font-normal text-slate-700"><span>{label}</span><PayrollDatePicker label={label} value={value} onChange={onChange}/>{error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}</div>;
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
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof PayrollPolicyForm>(key: K, value: PayrollPolicyForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const close = () => { if (dirty) setConfirmDiscard(true); else onCancel(); };
  const next = () => { const found = validatePayrollPolicyStep(form, step); setErrors(found); if (!Object.keys(found).length) setStep((value) => Math.min(3, value + 1)); };
  const submit = async () => { const found = validatePayrollPolicyForm(form); setErrors(found); if (Object.keys(found).length) { const first = [0, 1, 2, 3].find((index) => Object.keys(validatePayrollPolicyStep(form, index)).length); setStep(first ?? 0); return; } await onSave(payrollPolicyFormToDefinition(form)); };
  const numberInput = (value: number, onChange: (value: number) => void, extra?: string, min = 0) => <input type="number" inputMode="decimal" min={min} value={value} onChange={(event) => onChange(numberValue(event.target.value))} className={`${inputClass} ${extra ?? ""}`}/>;
  const percentInput = (value: number, onChange: (value: number) => void) => <div className="relative">{numberInput(value, onChange, "pr-9")}<span className="absolute right-3 top-3 text-sm text-slate-400">%</span></div>;

  const general = <div className="grid gap-4 md:grid-cols-2">
    <Field label="Mã công thức" error={errors.code}><input aria-label="Mã công thức" value={form.code} onChange={(e) => set("code", e.target.value)} className={inputClass}/></Field>
    <Field label="Tên công thức" error={errors.name}><input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass}/></Field>
    <DateField label="Hiệu lực từ" value={form.effectiveFrom} onChange={(value) => set("effectiveFrom", value)} error={errors.effectiveFrom}/>
    <DateField label="Hiệu lực đến" value={form.effectiveTo} onChange={(value) => set("effectiveTo", value)} error={errors.effectiveTo}/>
    <Field label="Lương cơ sở" error={errors.baseSalary}>{numberInput(form.baseSalary, (v) => set("baseSalary", v))}</Field>
    <Field label="Lương tối thiểu vùng" error={errors.regionalMinimumWage}>{numberInput(form.regionalMinimumWage, (v) => set("regionalMinimumWage", v))}</Field>
    <Field label="Hệ số trần BHXH/BHYT" error={errors.socialCapMultiplier}>{numberInput(form.socialCapMultiplier, (v) => set("socialCapMultiplier", v), undefined, 1)}</Field>
    <Field label="Hệ số trần BHTN" error={errors.unemploymentCapMultiplier}>{numberInput(form.unemploymentCapMultiplier, (v) => set("unemploymentCapMultiplier", v), undefined, 1)}</Field>
    <div className="md:col-span-2"><Field label="Nguồn tham chiếu / ghi chú"><textarea value={form.sourceReference} onChange={(e) => set("sourceReference", e.target.value)} rows={2} className={inputClass}/></Field></div>
  </div>;

  const fundNames: Record<FundCode, string> = { social: "Bảo hiểm xã hội", health: "Bảo hiểm y tế", unemployment: "Bảo hiểm thất nghiệp", accident: "Bảo hiểm tai nạn lao động", union: "Kinh phí công đoàn" };
  const insurance = <div className="space-y-4">{(Object.keys(fundNames) as FundCode[]).map((code) => <div key={code} className="rounded-xl bg-[#F3FAFF] p-3"><h4 className="mb-3 font-normal text-slate-800">{fundNames[code]}</h4><div className="grid gap-4 md:grid-cols-2"><Field label="Nhân viên đóng" error={errors[`funds.${code}.employeeRate`]}>{percentInput(form.funds[code].employeeRate, (v) => setForm((current) => ({ ...current, funds: { ...current.funds, [code]: { ...current.funds[code], employeeRate: v } } })))}</Field><Field label="Doanh nghiệp đóng" error={errors[`funds.${code}.employerRate`]}>{percentInput(form.funds[code].employerRate, (v) => setForm((current) => ({ ...current, funds: { ...current.funds, [code]: { ...current.funds[code], employerRate: v } } })))}</Field></div></div>)}</div>;

  const tax = <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2">
    <Field label="Giảm trừ bản thân">{numberInput(form.personalDeduction, (v) => set("personalDeduction", v))}</Field><Field label="Giảm trừ người phụ thuộc">{numberInput(form.dependentDeduction, (v) => set("dependentDeduction", v))}</Field>
    <Field label="Thuế khấu trừ ngắn hạn">{percentInput(form.shortTermWithholdingRate, (v) => set("shortTermWithholdingRate", v))}</Field><Field label="Ngưỡng khấu trừ ngắn hạn">{numberInput(form.shortTermWithholdingThreshold, (v) => set("shortTermWithholdingThreshold", v))}</Field>
    <Field label="Thuế suất không cư trú">{percentInput(form.nonResidentRate, (v) => set("nonResidentRate", v))}</Field>
  </div><div><div className="mb-2 flex items-center justify-between"><h4 className="font-normal text-slate-800">Bậc thuế lũy tiến</h4><button type="button" onClick={() => set("taxBrackets", [...form.taxBrackets.slice(0, -1), { upTo: "", rate: 0 }, form.taxBrackets.at(-1)!])} className="inline-flex items-center gap-1 text-sm font-normal text-[#007EB8]"><Plus size={15}/>Thêm bậc</button></div>{errors.taxBrackets && <p className="mb-2 text-xs text-rose-600">{errors.taxBrackets}</p>}<div className="space-y-2">{form.taxBrackets.map((bracket, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input aria-label={`Giới hạn bậc ${index + 1}`} type="number" placeholder={index === form.taxBrackets.length - 1 ? "Không giới hạn" : "Thu nhập đến"} value={bracket.upTo} onChange={(e) => set("taxBrackets", form.taxBrackets.map((item, i) => i === index ? { ...item, upTo: e.target.value } : item))} className={inputClass}/>{percentInput(bracket.rate, (v) => set("taxBrackets", form.taxBrackets.map((item, i) => i === index ? { ...item, rate: v } : item)))}<button type="button" disabled={form.taxBrackets.length === 1} onClick={() => set("taxBrackets", form.taxBrackets.filter((_, i) => i !== index))} className="mt-1 rounded-lg px-2 text-rose-500 disabled:opacity-30"><Trash2 size={17}/></button></div>)}</div></div></div>;

  const overtimeLabels: Record<keyof PayrollPolicyForm["overtime"], string> = { weekday: "Ngày thường", restDay: "Ngày nghỉ", holiday: "Ngày lễ", nightPremium: "Phụ cấp ban đêm", nightOvertimeBonus: "Bổ sung tăng ca đêm" };
  const overtime = <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2">{(Object.keys(overtimeLabels) as (keyof PayrollPolicyForm["overtime"])[]).map((key) => <Field key={key} label={`Hệ số ${overtimeLabels[key]}`} error={errors[`overtime.${key}`]}>{numberInput(form.overtime[key], (v) => set("overtime", { ...form.overtime, [key]: v }))}</Field>)}<Field label="Đơn vị làm tròn (VNĐ)" error={errors.roundingUnit}>{numberInput(form.roundingUnit, (v) => set("roundingUnit", v))}</Field></div><div className="rounded-xl bg-[#F1FAFE] p-4 text-sm text-slate-700"><h4 className="mb-2 font-normal text-[#007EB8]">Tóm tắt</h4><p>{form.name || "Công thức chưa đặt tên"} · hiệu lực từ {form.effectiveFrom || "chưa chọn"}</p><p>Lương cơ sở {money(form.baseSalary)} · {form.taxBrackets.length} bậc thuế · làm tròn {money(form.roundingUnit)}</p></div></div>;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><div role="dialog" aria-modal="true" className="flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(13,48,78,0.2)]"><header className="flex items-start justify-between border-b border-[#E8F0F8] bg-white px-4 py-3"><div><h3 className="text-base font-medium text-[#143963]">{mode === "create" ? "Tạo cách tính lương" : mode === "clone" ? "Sao chép cách tính" : "Sửa cách tính lương"}</h3></div><button aria-label="Đóng" onClick={close} className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white transition-colors hover:bg-rose-600"><X size={19}/></button></header><div className="grid grid-cols-2 gap-2 border-b border-[#E8F0F8] bg-[#F3FAFF] px-4 py-2 md:grid-cols-4">{steps.map((name, index) => <button type="button" key={name} onClick={() => { if (index < step) setStep(index); }} className={`rounded-lg px-2 py-2 text-xs font-normal ${index === step ? "bg-[#00A4E8] text-white" : index < step ? "bg-[#E8F7FF] text-[#007EB8]" : "bg-slate-100 text-slate-500"}`}>{index + 1}. {name}</button>)}</div><main className="min-h-0 flex-1 overflow-y-auto p-4">{step === 0 ? general : step === 1 ? insurance : step === 2 ? tax : overtime}</main><footer className="flex items-center justify-between border-t border-[#E8F0F8] bg-[#FAFCFE] px-4 py-3"><button type="button" onClick={close} className="rounded-xl border border-[#DCE7F4] bg-white px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-[#F8FBFE]">Hủy</button><div className="flex gap-2">{step > 0 && <button type="button" onClick={() => { setErrors({}); setStep(step - 1); }} className="rounded-xl border border-[#DCE7F4] bg-white px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-[#F8FBFE]">Quay lại</button>}{step < 3 ? <button type="button" onClick={next} className="rounded-xl bg-[#00A4E8] px-4 py-2 text-sm font-normal text-white transition-colors hover:bg-[#008FCB]">Tiếp tục</button> : <button type="button" disabled={saving} onClick={() => void submit()} className="rounded-xl bg-[#00A4E8] px-4 py-2 text-sm font-normal text-white transition-colors hover:bg-[#008FCB] disabled:opacity-50">{saving ? "Đang lưu..." : "Lưu công thức"}</button>}</div></footer></div>{confirmDiscard && <PayrollPolicyConfirmDialog title="Bỏ các thay đổi chưa lưu?" description="Các thay đổi trong công thức lương này chưa được lưu." confirmLabel="Bỏ thay đổi" cancelLabel="Tiếp tục chỉnh sửa" tone="warning" pending={false} onCancel={() => setConfirmDiscard(false)} onConfirm={() => { setConfirmDiscard(false); onCancel(); }}/>}</div>;
}
