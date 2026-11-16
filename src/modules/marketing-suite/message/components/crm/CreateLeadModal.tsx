import { useRef, useState, type FormEvent } from "react";
import { CurrencyInput } from "../../../../../components/common/CurrencyInput";
import { ErpModal } from "../../../../../components/common/ErpModal";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { StyledSelect } from "../../../../../components/common/StyledSelect";
import { DateInput24 } from "../../../../../components/common/TimeInput24";
import type { CustomerInbox } from "../../../shared/types/index";
import type { CreateLeadInput, ExtendedLeadCard } from "../../services/crmService";
import type { LeadIntakeField } from "../../../../../../shared/marketing-suite/lead-intake";
import { getColumnFilterOptions, isNameField, parseMultiSelectValue, PLATFORM_LABELS, type LeadAccountOption,
  type LeadSheetColumn, type LeadSocialPlatform } from "./leadSheetUtils";

type Scope = { platform: LeadSocialPlatform; accountId?: string };
type Props = {
  columns: LeadSheetColumn[];
  scope?: Scope;
  accounts: LeadAccountOption[];
  conversations: CustomerInbox[];
  onClose: () => void;
  onSave: (lead: CreateLeadInput) => Promise<void>;
};

const inputClass = "min-h-9 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant outline-none focus-visible:outline-2 focus-visible:outline-primary";

export function CreateLeadModal({ columns, scope, accounts, conversations, onClose, onSave }: Props) {
  const [accountKey, setAccountKey] = useState(() => {
    if (scope?.accountId) return `${scope.platform}:${scope.accountId}`;
    const scopedAccounts = scope ? accounts.filter(account => account.platform === scope.platform) : [];
    return scopedAccounts.length === 1 ? `${scopedAccounts[0].platform}:${scopedAccounts[0].accountId}` : "";
  });
  const [conversationId, setConversationId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const accountOptions = accounts.filter(account => !scope || account.platform === scope.platform);
  const account = accountOptions.find(option => `${option.platform}:${option.accountId}` === accountKey);
  const target = scope?.accountId ? scope : account;
  const availableConversations = target?.accountId ? conversations.filter(conversation =>
    conversation.channel === target.platform && (conversation.accountId || conversation.pageId) === target.accountId) : [];
  const linked = availableConversations.find(conversation => conversation.id === conversationId);
  const matching = columns.filter(column => column.editable && (
    !column.platform || (column.platform === target?.platform && (!column.accountId || column.accountId === target.accountId))
  ));
  const fields = matching.filter(column => !column.answerKey || !matching.some(other =>
    other.answerKey === column.answerKey && Number(Boolean(other.platform)) + Number(Boolean(other.accountId))
      > Number(Boolean(column.platform)) + Number(Boolean(column.accountId))));
  const nameField = fields.find(column => column.kind === "intake" && isNameField({ key: column.answerKey || column.key, label: column.label }))
    || fields.find(column => column.key === "customerName");

  function saveValue(key: string, value: string) {
    setValues(current => ({ ...current, [key]: value }));
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const answers: Record<string, string> = {};
    const system: Record<string, string> = {};
    const intakeFields = new Map<string, LeadIntakeField>();
    for (const field of fields) {
      const value = values[field.key]?.trim() || "";
      if (field.kind === "system") {
        if (value) system[field.key] = value;
        continue;
      }
      const key = field.answerKey || field.key;
      if (value) answers[key] = value;
      intakeFields.set(key, { key, label: field.label, question: field.question || field.label,
        required: field.required, type: field.type, options: field.options });
    }
    const name = (nameField ? values[nameField.key]?.trim() : "") || linked?.name || "";
    if (scope && !target?.accountId) {
      setError("Chọn tài khoản để lưu Lead vào đúng bảng.");
      return;
    }
    if (!name && !Object.keys(answers).length && !Object.keys(system).length) {
      setError("Nhập ít nhất một thông tin khách hàng.");
      return;
    }
    const { customerName, value, status, collectionStatus, phone, email, company } = system;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      await onSave({
        customerName: customerName || name || "Khách mới",
        avatar: "",
        company: company || "", phone: phone || "", email: email || "", productOfChoice: "",
        ...(value ? { value: Number(value) } : {}),
        status: (status || "cold") as ExtendedLeadCard["status"],
        lastInteraction: "Tạo Lead thủ công",
        answers,
        ...(intakeFields.size ? { intakeFields: [...intakeFields.values()] } : {}),
        ...(collectionStatus ? { collectionStatus: collectionStatus as ExtendedLeadCard["collectionStatus"] } : {}),
        ...(target?.accountId ? { sourcePlatform: target.platform, sourceAccountId: target.accountId } : {}),
        ...(linked ? { sourceConversationId: linked.id } : {}),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo Lead.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return <ErpModal title="Thêm Lead" maxWidth="max-w-xl" native onClose={onClose} closeDisabled={saving}>
    <form onSubmit={submit} className="space-y-4">
      {!scope?.accountId && accountOptions.length > 0 && <div className="space-y-1.5">
        <span className="block text-sm font-medium">Tài khoản lưu Lead</span>
        <StyledSelect ariaLabel="Tài khoản lưu Lead" disabled={saving} value={accountKey}
          placeholder={scope ? "Chọn tài khoản" : "Lead chung của doanh nghiệp"} options={[
          { value: "", label: scope ? "Chọn tài khoản" : "Lead chung của doanh nghiệp" },
          ...accountOptions.map(option => ({ value: `${option.platform}:${option.accountId}`, label: `${PLATFORM_LABELS[option.platform]} · ${option.displayName}` })),
        ]} onChange={key => {
          setAccountKey(key);
          setConversationId("");
          setValues(current => Object.fromEntries(Object.entries(current).filter(([key]) =>
            columns.some(column => column.key === key && !column.platform))));
          setError("");
        }} />
      </div>}
      {availableConversations.length > 0 && <div className="space-y-1.5">
        <span className="block text-sm font-medium">Liên kết hội thoại <span className="font-normal text-on-surface-variant">(tùy chọn)</span></span>
        <StyledSelect ariaLabel="Liên kết hội thoại" value={conversationId} disabled={saving} placeholder="Chọn hội thoại nếu có" options={[
          { value: "", label: "Chọn hội thoại nếu có" },
          ...availableConversations.map(conversation => ({ value: conversation.id, label: conversation.name })),
        ]} onChange={id => {
          const next = availableConversations.find(conversation => conversation.id === id);
          if (nameField && (!values[nameField.key] || values[nameField.key] === linked?.name)) {
            saveValue(nameField.key, next?.name || "");
          }
          setConversationId(id);
        }} />
      </div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(column => <LeadField key={column.key} column={column} value={values[column.key] || ""}
          disabled={saving} onChange={value => saveValue(column.key, value)} />)}
      </div>
      {!fields.length && <p className="text-sm text-on-surface-variant">Hiện cột có thể nhập hoặc chọn tài khoản có cột thu thập.</p>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-outline-variant pt-3">
        <button type="button" onClick={onClose} disabled={saving} className="min-h-10 rounded-md border border-outline-variant px-4 text-sm text-on-surface hover:bg-surface-container-low">Hủy</button>
        <button type="submit" disabled={saving || (!fields.length && !linked)} className={primaryCreateButtonClass}>
          {saving ? "Đang lưu…" : "Lưu Lead"}
        </button>
      </div>
    </form>
  </ErpModal>;
}

function LeadField({ column, value, disabled, onChange }: {
  column: LeadSheetColumn; value: string; disabled: boolean; onChange: (value: string) => void;
}) {
  const { label, type } = column;
  const options = getColumnFilterOptions(column);
  const selected = new Set(parseMultiSelectValue(value));
  const placeholder = `Nhập ${label.toLocaleLowerCase("vi-VN")}`;
  return <div className={`space-y-1 ${type === "long_text" || type === "multi_select" ? "sm:col-span-2" : ""}`}>
    <span className="block text-sm font-medium">{label}</span>
    {type === "long_text" ? <textarea aria-label={label} rows={2} value={value} disabled={disabled}
      placeholder={placeholder} onChange={event => onChange(event.target.value)} className={`${inputClass} py-2`} />
      : type === "multi_select" && options?.length ? <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map(option => <label key={option.value} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-outline-variant px-2 text-sm">
          <input type="checkbox" checked={selected.has(option.value)} disabled={disabled} className="size-4 accent-primary"
            onChange={event => {
              if (event.target.checked) selected.add(option.value);
              else selected.delete(option.value);
              onChange([...selected].join(", "));
            }} />
          {option.label}
        </label>)}
      </div> : options?.length ? <StyledSelect ariaLabel={label} value={value} disabled={disabled}
        options={[{ value: "", label: "Chọn một mục" }, ...options]} onChange={onChange} />
      : type === "currency" ? <CurrencyInput aria-label={label} allowEmpty value={value} disabled={disabled}
        onChange={(amount, formatted) => onChange(formatted ? String(amount) : "")} className={inputClass} />
      : type === "date" ? <DateInput24 ariaLabel={label} value={value} disabled={disabled} onChange={onChange} />
      : <input aria-label={label} type={type === "phone" ? "tel" : type === "email" ? "email" : type === "number" ? "number" : "text"}
        step={type === "number" ? "any" : undefined} disabled={disabled} placeholder={placeholder} value={value}
        onChange={event => onChange(event.target.value)} className={inputClass} />}
  </div>;
}
