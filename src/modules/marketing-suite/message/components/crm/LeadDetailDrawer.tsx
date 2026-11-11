import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowRightLeft, Loader2, MessageCircle, Trash2, X } from "lucide-react";
import type { LeadCollectionStatus, LeadIntakeField } from "../../../../../../shared/marketing-suite/lead-intake";
import { CurrencyInput } from "../../../../../components/common/CurrencyInput";
import { StyledSelect } from "../../../../../components/common/StyledSelect";
import { DateInput24 } from "../../../../../components/common/TimeInput24";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { crmService, type ExtendedLeadCard } from "../../services/crmService";
import { COLLECTION_STATUS_META, LEAD_STATUS_META, parseMultiSelectValue, PLATFORM_LABELS, type LeadSocialPlatform } from "./leadSheetUtils";

interface LeadDetailDrawerProps {
  lead: ExtendedLeadCard | null;
  configuredFields?: LeadIntakeField[];
  onClose: () => void;
  onUpdated: (updated: ExtendedLeadCard) => void;
  onOpenChat: (lead: ExtendedLeadCard) => void;
  onOpenModuleSync: (lead: ExtendedLeadCard) => void;
  onRequestDelete: (lead: ExtendedLeadCard) => void;
}

const fieldInputClass =
  "h-9 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary";
const secondaryBtnClass =
  "inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-1 focus-visible:outline-primary";

const statusSelectOptions = Object.entries(LEAD_STATUS_META).map(([key, meta]) => ({ value: key, label: meta.label }));
const collectionSelectOptions = [
  { value: "", label: "Chưa cấu hình" },
  ...Object.entries(COLLECTION_STATUS_META).map(([key, meta]) => ({ value: key, label: meta.label })),
];
const booleanSelectOptions = [
  { value: "", label: "Chưa chọn" },
  { value: "Có", label: "Có" },
  { value: "Không", label: "Không" },
];

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  configuredFields = [],
  onClose,
  onUpdated,
  onOpenChat,
  onOpenModuleSync,
  onRequestDelete,
}) => {
  const titleId = useId();
  const baseId = useId();
  const drawerRef = useRef<HTMLDivElement>(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [productOfChoice, setProductOfChoice] = useState("");
  const [status, setStatus] = useState<ExtendedLeadCard["status"]>("cold");
  const [value, setValue] = useState(0);
  const [collectionStatus, setCollectionStatus] = useState<LeadCollectionStatus | "">("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!lead) return;
    setCustomerName(lead.customerName || "");
    setPhone(lead.phone || "");
    setEmail(lead.email || "");
    setCompany(lead.company || "");
    setProductOfChoice(lead.productOfChoice || "");
    setStatus(lead.status || "cold");
    setValue(Number(lead.value) || 0);
    setCollectionStatus(lead.collectionStatus || "");
    setAnswers({ ...(lead.answers || {}) });
    setError("");
  }, [lead]);

  useEffect(() => {
    if (!lead) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawerRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [lead, saving, onClose]);

  if (!lead) return null;

  const fieldList = (lead.intakeFields && lead.intakeFields.length > 0) ? lead.intakeFields : configuredFields;
  const fieldKeySet = new Set(fieldList.map(field => field.key));
  const extraAnswerKeys = Object.keys(answers).filter(key => !key.startsWith("__") && !fieldKeySet.has(key) && Boolean(answers[key]?.trim()));

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!lead) return;
    if (!customerName.trim()) {
      setError("Họ tên khách hàng không được để trống.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const updated = await crmService.updateLead(lead.id, {
        customerName: customerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        company: company.trim(),
        productOfChoice: productOfChoice.trim(),
        status,
        value: Math.max(0, Number(value) || 0),
        ...(collectionStatus ? { collectionStatus } : {}),
        answers,
      });
      onUpdated(updated);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật Lead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45" role="presentation" onClick={() => { if (!saving) onClose(); }}>
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="flex h-dvh w-full max-w-xl flex-col border-l border-outline-variant bg-surface-container-lowest text-left text-on-surface shadow-xl outline-none"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-5 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <div className="min-w-0">
              <h3 id={titleId} className="truncate text-base font-semibold text-on-surface text-balance">
                {lead.customerName}
              </h3>
              <p className="text-xs text-on-surface-variant">
                {lead.sourcePlatform ? PLATFORM_LABELS[lead.sourcePlatform as LeadSocialPlatform] : "Tạo thủ công"}
                {lead.sourceAccountId ? ` · ${lead.sourceAccountId}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="Đóng"
            data-erp-modal-close
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-error text-on-error focus-visible:outline-1 focus-visible:outline-primary"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-outline-variant bg-surface-container-low px-4 py-2.5 sm:px-5">
          <button type="button" onClick={() => onOpenChat(lead)} className={secondaryBtnClass}>
            <MessageCircle aria-hidden="true" className="size-3.5 text-primary" />
            Mở hội thoại
          </button>
          <button
            type="button"
            disabled={Boolean(lead.moduleSync)}
            onClick={() => onOpenModuleSync(lead)}
            className={`${secondaryBtnClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <ArrowRightLeft aria-hidden="true" className="size-3.5" />
            {lead.moduleSync
              ? `Đã chuyển sang ${lead.moduleSync.targetModule === "students" ? "Học viên" : lead.moduleSync.targetModule === "healthcare" ? "Bệnh nhân" : "Lao động"}`
              : "Đồng bộ module"}
          </button>
          <button
            type="button"
            onClick={() => onRequestDelete(lead)}
            className={`${secondaryBtnClass} ml-auto text-error hover:bg-error-container`}
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            Xóa Lead
          </button>
        </div>

        <form onSubmit={(event) => void handleSave(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {error && <p role="alert" className="rounded-xl border border-error/30 bg-error-container px-3 py-2 text-xs text-on-error-container">{error}</p>}

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-on-surface-variant">Thông tin Lead theo bộ cột của bạn</h4>
                {fieldList.length > 0 && (
                  <span className="text-xs tabular-nums text-on-surface-variant">
                    {fieldList.filter(field => Boolean(answers[field.key]?.trim())).length}/{fieldList.length} trường đã điền
                  </span>
                )}
              </div>

              {fieldList.length === 0 && extraAnswerKeys.length === 0 ? (
                <p className="rounded-xl border border-outline-variant bg-surface-container-low p-3 text-xs text-on-surface-variant text-pretty">
                  Chưa có cột tùy chỉnh nào cho Lead này. Bấm <strong>+ Thêm cột</strong> ngay trên bảng để tự đưa các trường bạn cần vào.
                </p>
              ) : (
                <div className="space-y-3">
                  {fieldList.map(field => {
                    const currentVal = answers[field.key] || "";
                    const type = field.type || "text";
                    const inputId = `${baseId}-ans-${field.key}`;
                    return (
                      <div key={field.key} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor={inputId} className="text-xs font-medium text-on-surface">
                            {field.label}
                            {field.required !== false && <span className="ml-1 text-error">*</span>}
                          </label>
                          <span className="text-xs text-on-surface-variant">
                            {field.required !== false ? "Bot hỏi" : "Tùy chọn"}
                          </span>
                        </div>

                        {type === "long_text" ? (
                          <textarea
                            id={inputId}
                            aria-label={field.label}
                            rows={2}
                            value={currentVal}
                            onChange={(event) => setAnswers(current => ({ ...current, [field.key]: event.target.value }))}
                            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                          />
                        ) : type === "single_select" ? (
                          <StyledSelect
                            ariaLabel={field.label}
                            value={currentVal}
                            options={[{ value: "", label: "Chưa chọn" }, ...(field.options || []).map(opt => ({ value: opt, label: opt }))]}
                            onChange={(next) => setAnswers(current => ({ ...current, [field.key]: next }))}
                            className="h-9 rounded-xl"
                          />
                        ) : type === "multi_select" ? (
                          <div className="flex flex-wrap gap-1.5" role="group" aria-label={field.label}>
                            {(field.options || []).map(opt => {
                              const activeSet = new Set(parseMultiSelectValue(currentVal));
                              const checked = activeSet.has(opt);
                              return (
                                <label
                                  key={opt}
                                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs ${
                                    checked
                                      ? "border-primary bg-primary-container text-on-primary-container"
                                      : "border-outline-variant bg-surface-container-lowest text-on-surface"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) => {
                                      const next = new Set(parseMultiSelectValue(currentVal));
                                      if (event.target.checked) next.add(opt);
                                      else next.delete(opt);
                                      setAnswers(current => ({ ...current, [field.key]: [...next].join(", ") }));
                                    }}
                                    className="size-3.5 accent-primary"
                                  />
                                  <span>{opt}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : type === "checkbox" ? (
                          <StyledSelect
                            ariaLabel={field.label}
                            value={currentVal}
                            options={booleanSelectOptions}
                            onChange={(next) => setAnswers(current => ({ ...current, [field.key]: next }))}
                            className="h-9 rounded-xl"
                          />
                        ) : type === "currency" ? (
                          <CurrencyInput
                            id={inputId}
                            aria-label={field.label}
                            allowEmpty
                            value={currentVal}
                            onChange={(nextVal) => setAnswers(current => ({ ...current, [field.key]: nextVal ? String(nextVal) : "" }))}
                            className={`${fieldInputClass} tabular-nums`}
                          />
                        ) : type === "date" ? (
                          <DateInput24
                            ariaLabel={field.label}
                            value={/^\d{4}-\d{2}-\d{2}$/.test(currentVal) ? currentVal : ""}
                            onChange={(nextVal) => setAnswers(current => ({ ...current, [field.key]: nextVal }))}
                            className="min-h-9 rounded-xl"
                          />
                        ) : (
                          <input
                            id={inputId}
                            aria-label={field.label}
                            type={type === "email" ? "email" : type === "phone" ? "tel" : "text"}
                            inputMode={type === "number" ? "decimal" : undefined}
                            value={currentVal}
                            onChange={(event) => setAnswers(current => ({ ...current, [field.key]: event.target.value }))}
                            className={fieldInputClass}
                          />
                        )}
                      </div>
                    );
                  })}

                  {extraAnswerKeys.map(key => {
                    const inputId = `${baseId}-extra-${key}`;
                    return (
                      <div key={key} className="space-y-1">
                        <label htmlFor={inputId} className="block text-xs text-on-surface-variant">{key}</label>
                        <input
                          id={inputId}
                          value={answers[key] || ""}
                          onChange={(event) => setAnswers(current => ({ ...current, [key]: event.target.value }))}
                          className={fieldInputClass}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-3 border-t border-outline-variant pt-4">
              <h4 className="text-xs font-semibold text-on-surface-variant">Thông tin CRM hệ thống (tùy chọn)</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor={`${baseId}-name`} className="block text-xs text-on-surface-variant">Họ và tên *</label>
                  <input id={`${baseId}-name`} value={customerName} onChange={(event) => setCustomerName(event.target.value)} className={fieldInputClass} />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`${baseId}-phone`} className="block text-xs text-on-surface-variant">Số điện thoại</label>
                  <input id={`${baseId}-phone`} type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={fieldInputClass} />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`${baseId}-email`} className="block text-xs text-on-surface-variant">Email</label>
                  <input id={`${baseId}-email`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldInputClass} />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`${baseId}-company`} className="block text-xs text-on-surface-variant">Doanh nghiệp</label>
                  <input id={`${baseId}-company`} value={company} onChange={(event) => setCompany(event.target.value)} className={fieldInputClass} />
                </div>
                <div className="space-y-1">
                  <span className="block text-xs text-on-surface-variant">Trạng thái xử lý</span>
                  <StyledSelect
                    ariaLabel="Trạng thái xử lý"
                    value={status}
                    options={statusSelectOptions}
                    onChange={(next) => setStatus(next as ExtendedLeadCard["status"])}
                    className="h-9 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`${baseId}-value`} className="block text-xs text-on-surface-variant">Giá trị dự kiến (VNĐ)</label>
                  <CurrencyInput
                    id={`${baseId}-value`}
                    value={value}
                    onChange={(nextVal) => setValue(nextVal)}
                    className={`${fieldInputClass} tabular-nums`}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`${baseId}-product`} className="block text-xs text-on-surface-variant">Nhu cầu / Sản phẩm chính</label>
                  <input id={`${baseId}-product`} value={productOfChoice} onChange={(event) => setProductOfChoice(event.target.value)} className={fieldInputClass} />
                </div>
                <div className="space-y-1">
                  <span className="block text-xs text-on-surface-variant">Tình trạng thu thập</span>
                  <StyledSelect
                    ariaLabel="Tình trạng thu thập"
                    value={collectionStatus}
                    options={collectionSelectOptions}
                    onChange={(next) => setCollectionStatus(next as LeadCollectionStatus | "")}
                    className="h-9 rounded-xl"
                  />
                </div>
              </div>
            </section>
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-outline-variant bg-surface-container-lowest px-4 py-3 sm:px-5">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="min-h-9 rounded-xl border border-outline-variant px-3.5 text-xs font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-1 focus-visible:outline-primary"
            >
              Đóng
            </button>
            <button type="submit" disabled={saving} className={primaryCreateButtonClass}>
              {saving && <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />}
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
