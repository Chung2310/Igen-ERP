import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Loader2, Plus, Settings2, Sparkles, Trash2 } from "lucide-react";
import { ErpModal } from "../../../../../components/common/ErpModal";
import { StyledSelect } from "../../../../../components/common/StyledSelect";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { LEAD_INTAKE_FIELD_TYPES, type LeadIntakeField, type LeadIntakeFieldType } from "../../../../../../shared/marketing-suite/lead-intake";
import { crmService } from "../../services/crmService";
import { FIELD_TYPE_META, PLATFORM_LABELS, toIntakeFieldKey, type LeadAccountOption } from "./leadSheetUtils";

type EditableField = LeadIntakeField & {
  _localId: string;
  type: LeadIntakeFieldType;
  required: boolean;
  options: string[];
  _keyEdited?: boolean;
  _typeEdited?: boolean;
};

interface LeadIntakeBuilderModalProps {
  isOpen: boolean;
  accounts: LeadAccountOption[];
  initialAccountKey?: string;
  initialAddColumn?: boolean;
  focusFieldKey?: string;
  onClose: () => void;
  onSaved: (account: LeadAccountOption | null) => void;
}

const fieldInputClass =
  "h-9 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary disabled:opacity-50";
const secondaryBtnClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-xs font-medium text-on-surface hover:bg-surface-container-low focus-visible:outline-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

function makeFieldId() {
  return `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeEditableFields(fields: LeadIntakeField[]): EditableField[] {
  return fields.map(field => ({
    _localId: makeFieldId(),
    key: field.key || "",
    label: field.label || "",
    question: field.question || "",
    type: field.type || "text",
    required: field.required !== false,
    options: Array.isArray(field.options) ? field.options : [],
    _keyEdited: Boolean(field.key),
    _typeEdited: true,
  }));
}

function emptyField(): EditableField {
  return { _localId: makeFieldId(), key: "", label: "", question: "", type: "text", required: true, options: [] };
}

const starterFields: LeadIntakeField[] = [
  { key: "ho_va_ten", label: "Họ và tên", type: "text", required: false, question: "Tên khách tự cung cấp" },
  { key: "so_dien_thoai", label: "Số điện thoại", type: "phone", required: false, question: "Số điện thoại liên hệ của khách" },
  { key: "nhu_cau", label: "Nhu cầu", type: "long_text", required: true, question: "Sản phẩm, dịch vụ hoặc nhu cầu khách đang quan tâm" },
];

function inferFieldType(key: string): LeadIntakeFieldType {
  if (/^(?:so_dien_thoai|dien_thoai|sdt|phone)(?:_|$)/.test(key)) return "phone";
  if (/^(?:dia_chi_email|email)(?:_|$)/.test(key)) return "email";
  if (/^ngay_(?:sinh|hen|dat_lich|du_kien)(?:_|$)/.test(key)) return "date";
  if (/^(?:ngan_sach|muc_gia|hoc_phi)(?:_|$)/.test(key)) return "currency";
  return "text";
}

const fieldTypeSelectOptions = LEAD_INTAKE_FIELD_TYPES.map(type => ({
  value: type,
  label: FIELD_TYPE_META[type].shortLabel,
}));

export const LeadIntakeBuilderModal: React.FC<LeadIntakeBuilderModalProps> = ({
  isOpen,
  initialAccountKey,
  initialAddColumn = false,
  focusFieldKey,
  ...rest
}) => {
  if (!isOpen) return null;
  return (
    <LeadIntakeBuilderModalBody
      key={`${initialAccountKey || "company"}:${initialAddColumn ? 1 : 0}:${focusFieldKey || ""}`}
      initialAccountKey={initialAccountKey}
      initialAddColumn={initialAddColumn}
      focusFieldKey={focusFieldKey}
      {...rest}
    />
  );
};

function LeadIntakeBuilderModalBody({
  accounts,
  initialAccountKey,
  initialAddColumn = false,
  focusFieldKey,
  onClose,
  onSaved,
}: Omit<LeadIntakeBuilderModalProps, "isOpen">) {
  const [selectedAccountKey, setSelectedAccountKey] = useState<string>(() => {
    if (initialAccountKey && initialAccountKey !== "company" && accounts.some(a => `${a.platform}:${a.accountId}` === initialAccountKey)) {
      return initialAccountKey;
    }
    return "company";
  });
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState<"" | "suggest" | "draft" | "save">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [goal, setGoal] = useState("");
  const [completionMessage, setCompletionMessage] = useState("Cảm ơn anh/chị đã cung cấp thông tin, bên em sẽ tư vấn ngay ạ.");
  const [fields, setFields] = useState<EditableField[]>([]);
  const [hasOwnProfile, setHasOwnProfile] = useState(false);
  const [sourceDocumentIds, setSourceDocumentIds] = useState<string[]>([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedFieldId, setExpandedFieldId] = useState<string>();

  const newLabelInputRef = useRef<HTMLInputElement>(null);
  const focusedLabelInputRef = useRef<HTMLInputElement>(null);
  const pendingFocusNewRowRef = useRef(false);
  const pendingFocusTargetRef = useRef(false);

  const selectedAccount = useMemo(
    () => (selectedAccountKey === "company" ? null : accounts.find(acc => `${acc.platform}:${acc.accountId}` === selectedAccountKey) || null),
    [accounts, selectedAccountKey],
  );

  const scopeOptions = useMemo(
    () => [
      { value: "company", label: "Mặc định doanh nghiệp" },
      ...accounts.map(acc => ({
        value: `${acc.platform}:${acc.accountId}`,
        label: `${PLATFORM_LABELS[acc.platform]} · ${acc.displayName}`,
      })),
    ],
    [accounts],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setLoading(true);
      setLoadFailed(false);
      setError("");
      setNotice("");
      try {
        const { profiles, fallbackProfiles } = await crmService.getLeadIntakeProfilesForAccount(
          selectedAccount?.platform,
          selectedAccount?.accountId,
        );
        if (cancelled) return;
        const active = profiles.find(profile => profile.status === "active");
        const draft = profiles.find(profile => profile.status === "draft" && profile.version > (active?.version || 0));
        const fallback = selectedAccount ? fallbackProfiles.find(profile => profile.status === "active") : undefined;
        const base = draft || active || fallback;

        const baseFields = normalizeEditableFields(base?.fields || []);
        if (initialAddColumn && baseFields.length < 30) {
          pendingFocusNewRowRef.current = true;
          baseFields.push(emptyField());
        } else if (focusFieldKey) {
          pendingFocusTargetRef.current = true;
        }
        setGoal(base?.goal || "");
        setCompletionMessage(base?.completionMessage || "Cảm ơn anh/chị đã cung cấp thông tin, bên em sẽ tư vấn ngay ạ.");
        setSourceDocumentIds(base?.sourceDocumentIds || []);
        setFields(baseFields);
        setHasOwnProfile(Boolean(active || draft));
        setProfileStatus(draft ? "Bản nháp" : active ? "Đang áp dụng" : fallback ? "Dùng mặc định" : "Chưa thiết lập");
        setExpandedFieldId(undefined);
      } catch (cause) {
        if (!cancelled) {
          setLoadFailed(true);
          setError(cause instanceof Error ? cause.message : "Không thể tải cấu hình Lead.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [selectedAccount, initialAddColumn, focusFieldKey, loadAttempt]);

  useEffect(() => {
    if (!loading && pendingFocusNewRowRef.current) {
      pendingFocusNewRowRef.current = false;
      requestAnimationFrame(() => newLabelInputRef.current?.focus());
    } else if (!loading && pendingFocusTargetRef.current) {
      pendingFocusTargetRef.current = false;
      requestAnimationFrame(() => focusedLabelInputRef.current?.focus());
    }
  }, [loading, fields.length]);

  function addField() {
    if (fields.length >= 30) return;
    pendingFocusNewRowRef.current = true;
    setFields(current => [...current, emptyField()]);
  }

  function updateField(localId: string, patch: Partial<EditableField>) {
    setFields(current => {
      const usedKeys = new Set(current.filter(item => item._localId !== localId).map(item => item.key).filter(Boolean));
      return current.map(item => {
        if (item._localId !== localId) return item;
        const next = { ...item, ...patch };
        if ("label" in patch && !next._keyEdited) {
          next.key = next.label.trim() ? toIntakeFieldKey(next.label, usedKeys) : "";
          if (!next._typeEdited) next.type = inferFieldType(next.key);
        }
        return next;
      });
    });
  }

  function moveField(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    setFields(current => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  async function handleSuggest() {
    if (!goal.trim()) {
      setError("Nhập mục tiêu thu thập để AI gợi ý cột.");
      return;
    }
    setBusy("suggest");
    setError("");
    setNotice("");
    try {
      const suggested = await crmService.suggestLeadIntakeProfile({
        ...(selectedAccount ? { platform: selectedAccount.platform, accountId: selectedAccount.accountId } : {}),
        goal: goal.trim(),
      });
      const existingFields = fields.filter(field => field.label.trim() || field.key.trim());
      const existingKeys = new Set(existingFields.map(field => field.key));
      const existingLabels = new Set(existingFields.map(field => field.label.trim().toLocaleLowerCase()));
      const additions = (suggested.fields || []).filter(field => {
        const label = field.label.trim().toLocaleLowerCase();
        if (existingKeys.has(field.key) || existingLabels.has(label)) return false;
        existingKeys.add(field.key);
        existingLabels.add(label);
        return true;
      }).slice(0, 30 - existingFields.length);
      if (!additions.length) {
        setNotice("Không có cột mới phù hợp.");
        return;
      }
      setFields([...existingFields, ...normalizeEditableFields(additions)]);
      setSourceDocumentIds(current => [...new Set([...current, ...(suggested.sourceDocumentIds || [])])].slice(0, 50));
      setShowAiPanel(false);
      setNotice(`Đã thêm ${additions.length} cột gợi ý. Xem lại trước khi áp dụng.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đề xuất cột bằng AI.");
    } finally {
      setBusy("");
    }
  }

  async function handleSave(draftOnly = false) {
    if (loading || loadFailed || busy) return;
    setError("");
    setNotice("");

    if (fields.length === 0) {
      if (draftOnly || !hasOwnProfile) return;
      setBusy("save");
      try {
        await crmService.archiveLeadIntakeProfile(
          selectedAccount ? { platform: selectedAccount.platform, accountId: selectedAccount.accountId } : undefined,
        );
        onSaved(selectedAccount);
        onClose();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Không thể gỡ bộ cột tùy chỉnh.");
      } finally {
        setBusy("");
      }
      return;
    }

    const usedKeys = new Set<string>();
    const prepared: LeadIntakeField[] = [];
    for (let i = 0; i < fields.length; i += 1) {
      const item = fields[i];
      const label = item.label.trim();
      if (!label && !item.key && !item.question.trim()) continue;
      if (!label) {
        setError(`Cột số ${i + 1} chưa có tên.`);
        return;
      }
      const key = (item.key.trim() || toIntakeFieldKey(label, usedKeys)).toLowerCase();
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) {
        setError(`Mã trường "${key}" của cột "${label}" không hợp lệ.`);
        return;
      }
      if (usedKeys.has(key)) {
        setError(`Cột "${label}" bị trùng mã trường.`);
        return;
      }
      usedKeys.add(key);

      const options = (item.type === "single_select" || item.type === "multi_select")
        ? item.options.map(opt => opt.trim()).filter(Boolean)
        : [];
      if ((item.type === "single_select" || item.type === "multi_select") && options.length < 2) {
        setError(`Cột "${label}" cần ít nhất 2 lựa chọn (ngăn cách bằng dấu phẩy).`);
        return;
      }
      if (new Set(options.map(opt => opt.toLocaleLowerCase())).size !== options.length) {
        setError(`Cột "${label}" có lựa chọn bị trùng lặp.`);
        return;
      }

      prepared.push({
        key,
        label: label.slice(0, 100),
        question: (item.question.trim() || label).slice(0, 300),
        type: item.type,
        required: item.required,
        options: options.slice(0, 30),
      });
    }
    if (!prepared.length) {
      setError("Thêm ít nhất một cột để áp dụng.");
      return;
    }

    setBusy(draftOnly ? "draft" : "save");
    try {
      const input = {
        ...(selectedAccount ? { platform: selectedAccount.platform, accountId: selectedAccount.accountId } : {}),
        goal: (goal.trim() || "Thu thập thông tin khách hàng tiềm năng").slice(0, 300),
        completionMessage: (completionMessage.trim() || "Cảm ơn anh/chị đã cung cấp thông tin, bên em sẽ tư vấn ngay ạ.").slice(0, 500),
        fields: prepared,
        sourceDocumentIds,
      };
      if (draftOnly) {
        await crmService.saveLeadIntakeDraft(input);
        setProfileStatus("Bản nháp");
        setNotice("Đã lưu bản nháp.");
        return;
      }
      await crmService.saveAndActivateLeadIntakeProfile(input);
      onSaved(selectedAccount);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu cấu hình cột Lead.");
    } finally {
      setBusy("");
    }
  }

  const cannotEdit = Boolean(busy) || loading || loadFailed;
  const columnLayout = "sm:grid-cols-[minmax(0,1fr)_5rem_4.5rem]";

  return (
    <ErpModal
      isOpen
      title="Thiết lập thu thập Lead"
      maxWidth="max-w-3xl"
      native
      closeDisabled={Boolean(busy)}
      onClose={onClose}
    >
      <form onSubmit={event => { event.preventDefault(); void handleSave(); }} className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-on-surface">Tài khoản áp dụng</span>
            {!loading && !loadFailed && <span className="text-xs text-on-surface-variant">{profileStatus}</span>}
          </div>
          {accounts.length > 0 ? <div className="max-w-sm">
            <StyledSelect
              ariaLabel="Tài khoản áp dụng"
              value={selectedAccountKey}
              disabled={Boolean(busy) || loading}
              options={scopeOptions}
              onChange={next => {
                if (next === selectedAccountKey) return;
                setLoading(true);
                setSelectedAccountKey(next);
              }}
              className="h-9 rounded-xl text-xs"
            />
          </div> : <p className="text-sm text-on-surface">Mặc định doanh nghiệp</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-medium text-on-surface">Thông tin cần thu</h4>
            <p className="text-xs text-on-surface-variant">Bỏ chọn «Chủ động hỏi» để chỉ lưu khi khách tự chia sẻ.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={cannotEdit}
              aria-expanded={showAiPanel}
              onClick={() => setShowAiPanel(current => !current)}
              className={secondaryBtnClass}
            >
              <Sparkles aria-hidden="true" className="size-3.5 text-primary" />
              AI gợi ý
            </button>
            <button
              type="button"
              disabled={cannotEdit || fields.length >= 30}
              onClick={addField}
              className={secondaryBtnClass}
            >
              <Plus aria-hidden="true" className="size-3.5" />
              Thêm cột
            </button>
          </div>
        </div>

        {!cannotEdit && !hasOwnProfile && !fields.some(field => field.label.trim()) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-3">
            <div>
              <p className="text-sm font-medium text-on-surface">Bộ cột cơ bản</p>
              <p className="text-xs text-on-surface-variant">Họ và tên, số điện thoại, nhu cầu</p>
            </div>
            <button type="button" className={secondaryBtnClass} onClick={() => {
              setFields(normalizeEditableFields(starterFields));
              setError("");
            }}>Dùng bộ cơ bản</button>
          </div>
        )}

        {showAiPanel && (
          <div className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-2.5 sm:flex-row sm:items-center">
            <input
              aria-label="Mục tiêu thu thập của doanh nghiệp"
              value={goal}
              disabled={Boolean(busy)}
              onChange={(event) => setGoal(event.target.value)}
              onKeyDown={event => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                event.preventDefault();
                if (!cannotEdit && goal.trim()) void handleSuggest();
              }}
              placeholder="Ví dụ: Lấy nhu cầu và số liên hệ để tư vấn khóa học"
              className={fieldInputClass}
            />
            <button
              type="button"
              disabled={Boolean(busy) || !goal.trim()}
              onClick={() => void handleSuggest()}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-medium text-on-primary hover:opacity-90 disabled:opacity-50"
            >
              {busy === "suggest" ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Sparkles aria-hidden="true" className="size-3.5" />}
              {busy === "suggest" ? "Đang gợi ý…" : "Gợi ý cột"}
            </button>
          </div>
        )}

        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-on-surface-variant">
            <Loader2 aria-hidden="true" className="size-4 animate-spin text-primary" />
            Đang tải cấu hình…
          </div>
        ) : loadFailed ? (
          <button type="button" className={secondaryBtnClass} onClick={() => { setLoading(true); setLoadAttempt(count => count + 1); }}>Thử tải lại</button>
        ) : (
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
            <div className={`hidden items-center gap-2 border-b border-outline-variant bg-surface-container-low px-3 py-2 text-xs font-medium text-on-surface-variant sm:grid ${columnLayout}`}>
              <span>Tên cột</span>
              <span className="text-center">Chủ động hỏi</span>
              <span className="text-right">Thao tác</span>
            </div>

            <div className="max-h-80 divide-y divide-outline-variant overflow-y-auto">
              {fields.length === 0 ? (
                <div className="p-4 text-center text-xs text-on-surface-variant text-pretty">
                  Chưa có cột tùy chỉnh.
                </div>
              ) : fields.map((field, index) => {
                const isLastRow = index === fields.length - 1;
                const isFocusedRow = Boolean(focusFieldKey && field.key === focusFieldKey);
                const needsOptions = field.type === "single_select" || field.type === "multi_select";
                return (
                  <div key={field._localId} className="space-y-2 px-3 py-2">
                    <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 ${columnLayout}`}>
                      <input
                        ref={isFocusedRow ? focusedLabelInputRef : isLastRow ? newLabelInputRef : undefined}
                        aria-label={`Tên cột ${index + 1}`}
                        value={field.label}
                        disabled={Boolean(busy)}
                        onChange={(event) => updateField(field._localId, { label: event.target.value })}
                        placeholder="Ví dụ: Nhu cầu"
                        className={`col-span-2 sm:col-span-1 ${fieldInputClass}`}
                      />
                      <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 text-xs text-on-surface sm:justify-center">
                        <input
                          type="checkbox"
                          aria-label={`Chủ động hỏi cột ${field.label || index + 1}`}
                          checked={field.required}
                          disabled={Boolean(busy)}
                          onChange={(event) => updateField(field._localId, { required: event.target.checked })}
                          className="size-4 accent-primary"
                        />
                        <span className="sm:sr-only">Chủ động hỏi</span>
                      </label>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" disabled={Boolean(busy)}
                          aria-label={`Tùy chỉnh cột ${field.label || index + 1}`}
                          title="Tùy chỉnh cột"
                          aria-expanded={expandedFieldId === field._localId}
                          onClick={() => setExpandedFieldId(current => current === field._localId ? undefined : field._localId)}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">
                          <Settings2 aria-hidden="true" className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          aria-label={`Xóa cột ${field.label || index + 1}`}
                          title="Xóa cột"
                          onClick={() => setFields(current => current.filter(item => item._localId !== field._localId))}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-error-container hover:text-error focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {needsOptions && (
                      <div>
                        <input
                          aria-label={`Lựa chọn cho cột ${field.label || index + 1}`}
                          value={field.options.join(",")}
                          disabled={Boolean(busy)}
                          onChange={(event) => updateField(field._localId, {
                            options: event.target.value.split(",").slice(0, 30),
                          })}
                          placeholder="Ví dụ: Gói cơ bản, Gói nâng cao"
                          className={fieldInputClass}
                        />
                      </div>
                    )}

                    {expandedFieldId === field._localId && (
                      <div className="grid gap-2 rounded-lg bg-surface-container-low p-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                        <div className="space-y-1 text-xs text-on-surface-variant">
                          <span>Kiểu dữ liệu</span>
                          <StyledSelect
                            ariaLabel={`Kiểu dữ liệu cột ${index + 1}`}
                            value={field.type}
                            disabled={Boolean(busy)}
                            options={fieldTypeSelectOptions}
                            onChange={next => {
                              const type = next as LeadIntakeFieldType;
                              updateField(field._localId, { type, _typeEdited: true,
                                options: type === "single_select" || type === "multi_select" ? field.options : [] });
                            }}
                            className="h-9 rounded-xl text-xs"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <button type="button" className={secondaryBtnClass} disabled={Boolean(busy) || index === 0}
                            aria-label={`Di chuyển cột ${index + 1} lên`} onClick={() => moveField(index, -1)}>
                            <ArrowUp aria-hidden="true" className="size-3.5" />
                          </button>
                          <button type="button" className={secondaryBtnClass} disabled={Boolean(busy) || index === fields.length - 1}
                            aria-label={`Di chuyển cột ${index + 1} xuống`} onClick={() => moveField(index, 1)}>
                            <ArrowDown aria-hidden="true" className="size-3.5" />
                          </button>
                        </div>
                        <label className="block space-y-1 text-xs text-on-surface-variant">
                          <span>Gợi ý nhận diện dữ liệu</span>
                          <input
                            aria-label={`Gợi ý nhận diện dữ liệu cho cột ${field.label || index + 1}`}
                            value={field.question}
                            disabled={Boolean(busy)}
                            onChange={(event) => updateField(field._localId, { question: event.target.value })}
                            placeholder="Ví dụ: Số điện thoại để tư vấn khóa học"
                            className={fieldInputClass}
                          />
                        </label>
                        <label className="block space-y-1 text-xs text-on-surface-variant">
                          <span>Mã cột</span>
                          <input value={field.key} disabled={Boolean(busy)}
                            onChange={event => updateField(field._localId, {
                              key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40),
                              _keyEdited: Boolean(event.target.value),
                            })}
                            className={fieldInputClass} placeholder="Tự tạo theo tên" />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            disabled={cannotEdit}
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced(current => !current)}
            className="inline-flex items-center gap-1.5 rounded-md text-on-surface-variant hover:text-on-surface focus-visible:outline-1 focus-visible:outline-primary disabled:opacity-50"
          >
            <ChevronRight aria-hidden="true" className={`size-3.5 ${showAdvanced ? "rotate-90" : ""}`} />
            Nâng cao
          </button>
        </div>

        {showAdvanced && !loadFailed && (
          <div>
            <label className="block space-y-1 text-xs text-on-surface-variant">
              <span>Mục tiêu thu thập</span>
              <input value={goal} disabled={cannotEdit} onChange={event => setGoal(event.target.value)} className={fieldInputClass} />
            </label>
          </div>
        )}

        {error && <p role="alert" className="rounded-xl border border-error/30 bg-error-container px-3 py-2 text-xs text-on-error-container">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-primary/20 bg-primary-fixed px-3 py-2 text-xs text-on-primary-fixed">{notice}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant pt-3">
          <button type="button" disabled={Boolean(busy)} onClick={onClose} className={secondaryBtnClass}>Hủy</button>
          {showAdvanced && fields.length > 0 && <button type="button" disabled={cannotEdit} onClick={() => void handleSave(true)} className={secondaryBtnClass}>
            {busy === "draft" ? "Đang lưu…" : "Lưu nháp"}
          </button>}
          <button type="submit" disabled={cannotEdit || (!fields.length && !hasOwnProfile)} className={primaryCreateButtonClass}>
            {busy === "save" && <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />}
            {busy === "save" ? "Đang lưu…" : !fields.length && hasOwnProfile ? "Gỡ bộ cột" : "Lưu & áp dụng"}
          </button>
        </div>
      </form>
    </ErpModal>
  );
};
