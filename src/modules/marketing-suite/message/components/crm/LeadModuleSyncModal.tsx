import { useEffect, useMemo, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { ErpModal } from "../../../../../components/common/ErpModal";
import type { LeadTargetModule } from "../../../../../../shared/marketing-suite/lead-intake";
import { leadModuleTargets, type LeadModuleDestination } from "../../../../../../shared/marketing-suite/lead-module-destination";
import { getAccessToken } from "../../../shared/services/authService";
import { leadModuleDestinationService } from "../../../shared/services/leadModuleDestinationService";
import { crmService, type ExtendedLeadCard } from "../../services/crmService";

const recordLabels: Record<LeadTargetModule, string> = {
  students: "học viên",
  healthcare: "bệnh nhân",
  workers: "lao động",
};
const inputClass = "min-h-10 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary focus-visible:outline-1 focus-visible:outline-primary";
const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-sm font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

type Values = { fullName: string; phone: string; email: string; dateOfBirth: string; address: string; registrationDate: string };
type Props = { lead: ExtendedLeadCard; companyCode: string; branchId: string; enabledModules?: string[]; onClose: () => void; onCompleted: (value: NonNullable<ExtendedLeadCard["moduleSync"]>) => void };

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function answerFor(lead: ExtendedLeadCard, aliases: string[]) {
  const wanted = new Set(aliases.map(normalized));
  for (const field of lead.intakeFields || []) {
    if (wanted.has(normalized(field.key)) || wanted.has(normalized(field.label))) {
      const answer = lead.answers?.[field.key]?.trim();
      if (answer) return answer;
    }
  }
  for (const [key, answer] of Object.entries(lead.answers || {})) if (wanted.has(normalized(key)) && answer.trim()) return answer.trim();
  return "";
}
function initialValues(lead: ExtendedLeadCard): Values {
  const birthday = answerFor(lead, ["birthday", "date of birth", "ngay sinh"]);
  return {
    fullName: lead.customerName || answerFor(lead, ["name", "full name", "ho ten"]),
    phone: lead.phone || answerFor(lead, ["phone", "phone number", "so dien thoai", "sdt"]),
    email: lead.email || answerFor(lead, ["email", "thu dien tu"]),
    dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(birthday) ? birthday : "",
    address: answerFor(lead, ["address", "dia chi"]),
    registrationDate: new Date().toISOString().slice(0, 10),
  };
}
function collectedNotes(lead: ExtendedLeadCard) {
  const labels = new Map((lead.intakeFields || []).map(field => [field.key, field.label]));
  const answers = Object.entries(lead.answers || {}).filter(([, answer]) => answer.trim())
    .map(([key, answer]) => `${labels.get(key) || key}: ${answer}`);
  return [`Thông tin từ Lead${lead.sourcePlatform ? ` (${lead.sourcePlatform})` : ""}:`, ...answers].join("\n").slice(0, 1000);
}
async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || "Không thể tạo hồ sơ trong module đích.");
  return result;
}
function recordId(value: unknown): string {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  const data = raw?.data && typeof raw.data === "object" ? (raw.data as Record<string, unknown>) : null;
  const worker = raw?.worker && typeof raw.worker === "object" ? (raw.worker as Record<string, unknown>) : null;
  const id = data?._id || data?.id || raw?._id || raw?.id || worker?._id || worker?.id;
  if (typeof id !== "string" || !id) throw new Error("Module đã phản hồi thành công nhưng không trả mã hồ sơ. Hãy kiểm tra module đích trước khi thử lại.");
  return id;
}

export function LeadModuleSyncModal({ lead, companyCode, branchId, enabledModules, onClose, onCompleted }: Props) {
  const [destination, setDestination] = useState<LeadModuleDestination>();
  const [destinationFailed, setDestinationFailed] = useState(false);
  const [targetModule, setTargetModule] = useState<LeadTargetModule | "">("");
  const [values, setValues] = useState(() => initialValues(lead));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createdTarget, setCreatedTarget] = useState<{ targetModule: LeadTargetModule; targetRecordId: string } | null>(null);
  const notes = useMemo(() => collectedNotes(lead), [lead]);
  const loadingDestination = !destination && !destinationFailed;
  const availableModules = leadModuleTargets.filter(module => destination
    ? destination.availableModules.includes(module.value) : enabledModules?.includes(module.moduleKey));
  const activeTargetModule = availableModules.find(module => module.value === targetModule)?.value;
  const setValue = (key: keyof Values, value: string) => setValues(current => ({ ...current, [key]: value }));

  useEffect(() => {
    const controller = new AbortController();
    void leadModuleDestinationService.resolveForLead(lead.id, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setDestination(result);
      setTargetModule(result.targetModule && result.availableModules.includes(result.targetModule) ? result.targetModule : "");
    }).catch(() => {
      if (!controller.signal.aborted) setDestinationFailed(true);
    });
    return () => controller.abort();
  }, [lead.id]);

  async function createTargetRecord(activeTargetModule: LeadTargetModule) {
    if (activeTargetModule === "students") {
      return recordId(await postJson("/api/v1/students", {
        fullName: values.fullName.trim(), phone: values.phone.trim(), email: values.email.trim(),
        registrationDate: values.registrationDate, birthday: values.dateOfBirth, address: values.address.trim(),
        referral: `Lead ${lead.sourcePlatform || "thủ công"}`,
      }));
    }
    if (activeTargetModule === "healthcare") {
      return recordId(await postJson("/api/v1/healthcare/patients", {
        name: values.fullName.trim(), phone: values.phone.trim(), dateOfBirth: values.dateOfBirth,
        address: values.address.trim(), note: notes,
      }));
    }
    if (!companyCode) throw new Error("Không xác định được doanh nghiệp để tạo hồ sơ lao động.");
    const params = new URLSearchParams({ companyCode, ...(branchId ? { branchId } : {}) });
    return recordId(await postJson(`/api/v1/worker-management/workers?${params}`, {
      fullName: values.fullName.trim(), phone: values.phone.trim(), email: values.email.trim(),
      birthday: values.dateOfBirth, address: values.address.trim(), note: notes,
    }));
  }

  async function submit() {
    if (!activeTargetModule || busy || missingRequired) return;
    setBusy(true); setError("");
    try {
      const target = createdTarget || { targetModule: activeTargetModule, targetRecordId: await createTargetRecord(activeTargetModule) };
      if (!createdTarget) setCreatedTarget(target);
      const linked = await crmService.markLeadModuleSynced(lead.id, target);
      onCompleted(linked);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đồng bộ Lead vào module.");
    } finally { setBusy(false); }
  }

  const missingRequired = loadingDestination || !activeTargetModule || !values.fullName.trim() || (activeTargetModule === "students" && (!values.phone.trim() || !values.email.trim() || !values.registrationDate));
  return <ErpModal native title={`Đồng bộ Lead: ${lead.customerName}`} onClose={onClose} maxWidth="max-w-2xl" closeDisabled={busy}>
    <p className="text-pretty text-sm text-on-surface-variant">Kiểm tra thông tin rồi xác nhận tạo hồ sơ trong phân hệ đích.</p>
    <label className="block space-y-1 text-sm font-medium">Phân hệ đích
      <select className={inputClass} value={activeTargetModule || ""} onChange={event => setTargetModule(event.target.value as LeadTargetModule)}
        disabled={loadingDestination || busy || Boolean(createdTarget) || !availableModules.length}>
        <option value="" disabled>Chọn phân hệ</option>
        {availableModules.map(module => <option key={module.value} value={module.value}>{module.label}</option>)}
      </select>
    </label>
    {loadingDestination && <p role="status" className="text-xs text-on-surface-variant">Đang tải phân hệ đích…</p>}
    {destinationFailed && <p role="status" className="text-xs text-on-surface-variant">Chưa tải được cấu hình kênh nguồn. Bạn có thể chọn phân hệ đang bật.</p>}
    {destination?.targetModule && activeTargetModule === destination.targetModule && (
      <p className="text-xs text-on-surface-variant">Đã chọn sẵn theo cấu hình kênh nguồn.</p>
    )}
    {!loadingDestination && !availableModules.length && (
      <p className="rounded-md bg-surface-container p-3 text-sm text-on-surface-variant">Cần bật phân hệ Học viên, Y tế hoặc Lao động để nhận Lead.</p>
    )}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block space-y-1 text-sm">Họ và tên *
        <input className={inputClass} value={values.fullName} onChange={event => setValue("fullName", event.target.value)} autoComplete="name" />
      </label>
      <label className="block space-y-1 text-sm">Số điện thoại{activeTargetModule === "students" ? " *" : ""}
        <input className={inputClass} value={values.phone} onChange={event => setValue("phone", event.target.value)} autoComplete="tel" />
      </label>
      {(activeTargetModule === "students" || activeTargetModule === "workers") && <label className="block space-y-1 text-sm">Email{activeTargetModule === "students" ? " *" : ""}
        <input className={inputClass} type="email" value={values.email} onChange={event => setValue("email", event.target.value)} autoComplete="email" />
      </label>}
      <label className="block space-y-1 text-sm">Ngày sinh
        <input className={inputClass} type="date" value={values.dateOfBirth} onChange={event => setValue("dateOfBirth", event.target.value)} />
      </label>
      {activeTargetModule === "students" && <label className="block space-y-1 text-sm">Ngày đăng ký *
        <input className={inputClass} type="date" value={values.registrationDate} onChange={event => setValue("registrationDate", event.target.value)} />
      </label>}
      <label className="block space-y-1 text-sm sm:col-span-2">Địa chỉ
        <input className={inputClass} value={values.address} onChange={event => setValue("address", event.target.value)} autoComplete="street-address" />
      </label>
    </div>
    {Object.keys(lead.answers || {}).length > 0 && <details className="rounded-md border border-outline-variant bg-surface-container-low p-3 text-sm">
      <summary className="cursor-pointer font-medium">Thông tin khách đã cung cấp ({Object.keys(lead.answers || {}).length} trường)</summary>
      <dl className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {(lead.intakeFields || []).filter(field => lead.answers?.[field.key]).map(field => <div key={field.key} className="min-w-0">
          <dt className="text-xs text-on-surface-variant">{field.label}</dt><dd className="break-words text-sm">{lead.answers?.[field.key]}</dd>
        </div>)}
      </dl>
    </details>}
    {error && <p role="alert" className="rounded-md border border-error/30 bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
    {createdTarget && error && <p className="text-xs text-on-surface-variant">Hồ sơ đích đã được tạo. Bấm lại để hoàn tất liên kết với Lead; không tạo hồ sơ khác.</p>}
    <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant pt-3">
      <button type="button" className={buttonClass} onClick={onClose} disabled={busy}>Hủy</button>
      <button type="button" className={`${buttonClass} border-primary bg-primary text-on-primary hover:opacity-90`} onClick={() => void submit()} disabled={busy || missingRequired}>
        {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ArrowRight aria-hidden="true" className="size-4" />}
        {busy ? "Đang đồng bộ…" : createdTarget ? "Hoàn tất liên kết Lead" : activeTargetModule ? `Tạo hồ sơ ${recordLabels[activeTargetModule]}` : "Tạo hồ sơ"}
      </button>
    </div>
  </ErpModal>;
}
