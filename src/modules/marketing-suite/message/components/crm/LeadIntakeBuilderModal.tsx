import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { ErpModal } from "../../../../../components/common/ErpModal";
import { StyledSelect } from "../../../../../components/common/StyledSelect";
import { primaryCreateButtonClass } from "../../../../../components/common/primaryCreateButton";
import { LEAD_INTAKE_FIELD_TYPES, type LeadIntakeField, type LeadIntakeFieldType } from "../../../../../../shared/marketing-suite/lead-intake";
import { crmService } from "../../services/crmService";
import { defaultBotQuestion, FIELD_TYPE_META, PLATFORM_LABELS, toIntakeFieldKey, type LeadAccountOption } from "./leadSheetUtils";

type EditableField = LeadIntakeField & {
  _localId: string;
  type: LeadIntakeFieldType;
  required: boolean;
  options: string[];
  _keyEdited?: boolean;
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
  }));
}

function defaultStarterFields(): EditableField[] {
  return [
    {
      _localId: makeFieldId(),
      key: "",
      label: "",
      question: "",
      type: "text",
      required: true,
      options: [],
      _keyEdited: false,
    },
  ];
}

const fieldTypeSelectOptions = LEAD_INTAKE_FIELD_TYPES.map(type => ({
  value: type,
  label: FIELD_TYPE_META[type].label,
}));

export const LeadIntakeBuilderModal: React.FC<LeadIntakeBuilderModalProps> = ({
  isOpen,
  accounts,
  initialAccountKey,
  initialAddColumn = false,
  focusFieldKey,
  onClose,
  onSaved,
}) => {
  const [selectedAccountKey, setSelectedAccountKey] = useState<string>(() => {
    if (initialAccountKey && initialAccountKey !== "company" && accounts.some(a => `${a.platform}:${a.accountId}` === initialAccountKey)) {
      return initialAccountKey;
    }
    return "company";
  });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"" | "suggest" | "save">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [goal, setGoal] = useState("Thu thập thông tin khách hàng tiềm năng");
  const [completionMessage, setCompletionMessage] = useState("Cảm ơn anh/chị đã cung cấp thông tin, bên em sẽ tư vấn ngay ạ.");
  const [fields, setFields] = useState<EditableField[]>(defaultStarterFields);
  const [sourceDocumentIds, setSourceDocumentIds] = useState<string[]>([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showBotQuestions, setShowBotQuestions] = useState(false);

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
      { value: "company", label: "Mặc định toàn bảng (Sheet & tất cả kênh)" },
      ...accounts.map(acc => ({
        value: `${acc.platform}:${acc.accountId}`,
        label: `${PLATFORM_LABELS[acc.platform]} · ${acc.displayName}`,
      })),
    ],
    [accounts],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (initialAccountKey === "company") {
      setSelectedAccountKey("company");
    } else if (initialAccountKey && accounts.some(a => `${a.platform}:${a.accountId}` === initialAccountKey)) {
      setSelectedAccountKey(initialAccountKey);
    } else if (!selectedAccountKey) {
      setSelectedAccountKey("company");
    }
  }, [isOpen, initialAccountKey, accounts, selectedAccountKey]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setNotice("");

    void crmService
      .getLeadIntakeProfilesForAccount(selectedAccount?.platform, selectedAccount?.accountId)
      .then(({ profiles, fallbackProfiles }) => {
        if (cancelled) return;
        const active = profiles.find(profile => profile.status === "active");
        const draft = profiles.find(profile => profile.status === "draft");
        const fallback = selectedAccount ? fallbackProfiles.find(profile => profile.status === "active") : undefined;
        const base = draft || active || fallback;

        const baseFields = base?.fields?.length ? normalizeEditableFields(base.fields) : defaultStarterFields();
        if (initialAddColumn && base?.fields?.length && baseFields.length < 30) {
          pendingFocusNewRowRef.current = true;
          baseFields.push({
            _localId: makeFieldId(),
            key: "",
            label: "",
            question: "",
            type: "text",
            required: true,
            options: [],
            _keyEdited: false,
          });
        } else if (initialAddColumn && !base?.fields?.length) {
          pendingFocusNewRowRef.current = true;
        } else if (focusFieldKey) {
          pendingFocusTargetRef.current = true;
        }
        setGoal(base?.goal || "Thu thập thông tin khách hàng tiềm năng");
        setCompletionMessage(base?.completionMessage || "Cảm ơn anh/chị đã cung cấp thông tin, bên em sẽ tư vấn ngay ạ.");
        setSourceDocumentIds(base?.sourceDocumentIds || []);
        setFields(baseFields);
        if (selectedAccount && !active && fallback) {
          setNotice("Đang dùng bộ cột mặc định chung. Bấm Lưu nếu muốn tùy biến riêng cho kênh này.");
        }
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Không thể tải cấu hình cột Lead.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, selectedAccount, initialAddColumn, focusFieldKey]);

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
    setFields(current => [
      ...current,
      {
        _localId: makeFieldId(),
        key: "",
        label: "",
        question: "",
        type: "text",
        required: true,
        options: [],
        _keyEdited: false,
      },
    ]);
  }

  function updateField(localId: string, patch: Partial<EditableField>) {
    setFields(current => {
      const usedKeys = new Set(current.filter(item => item._localId !== localId).map(item => item.key).filter(Boolean));
      return current.map(item => {
        if (item._localId !== localId) return item;
        const next = { ...item, ...patch };
        if ("label" in patch && !next._keyEdited) {
          next.key = next.label.trim() ? toIntakeFieldKey(next.label, usedKeys) : "";
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
      setError("Hãy nhập ngắn gọn ngành hàng hoặc mục tiêu để AI gợi ý cột.");
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
      setFields(normalizeEditableFields(suggested.fields || []));
      if (suggested.completionMessage) setCompletionMessage(suggested.completionMessage);
      setSourceDocumentIds(suggested.sourceDocumentIds || []);
      setShowAiPanel(false);
      setNotice("AI đã tạo bộ cột mẫu bên dưới. Bạn có thể sửa lại rồi bấm Lưu & Áp dụng cho Chatbot.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đề xuất cột bằng AI.");
    } finally {
      setBusy("");
    }
  }

  async function handleSaveAndActivate(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (fields.length === 0) {
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
        question: (item.question.trim() || defaultBotQuestion(label, item.type)).slice(0, 300),
        type: item.type,
        required: item.required,
        options: options.slice(0, 30),
      });
    }

    setBusy("save");
    try {
      await crmService.saveAndActivateLeadIntakeProfile({
        ...(selectedAccount ? { platform: selectedAccount.platform, accountId: selectedAccount.accountId } : {}),
        goal: (goal.trim() || "Thu thập thông tin khách hàng tiềm năng").slice(0, 300),
        completionMessage: (completionMessage.trim() || "Cảm ơn anh/chị đã cung cấp thông tin, bên em sẽ tư vấn ngay ạ.").slice(0, 500),
        fields: prepared,
        sourceDocumentIds,
      });
      onSaved(selectedAccount);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu cấu hình cột Lead.");
    } finally {
      setBusy("");
    }
  }

  return (
    <ErpModal
      isOpen={isOpen}
      title="Cấu hình cột Lead & câu hỏi Chatbot"
      maxWidth="max-w-3xl"
      closeDisabled={Boolean(busy)}
      onClose={onClose}
    >
      <form onSubmit={(event) => void handleSaveAndActivate(event)} className="space-y-3">
        {/* Compact scope + AI toggle bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1">
            <StyledSelect
              ariaLabel="Phạm vi áp dụng bộ cột"
              value={selectedAccountKey}
              disabled={Boolean(busy) || loading}
              options={scopeOptions}
              onChange={setSelectedAccountKey}
              className="h-9 rounded-xl text-xs"
            />
          </div>
          <button
            type="button"
            disabled={Boolean(busy) || loading}
            onClick={() => setShowAiPanel(current => !current)}
            className={`${secondaryBtnClass} text-primary`}
          >
            <Sparkles aria-hidden="true" className="size-3.5" />
            AI gợi ý cột
          </button>
          <button
            type="button"
            disabled={Boolean(busy) || fields.length >= 30 || loading}
            onClick={addField}
            className={secondaryBtnClass}
          >
            <Plus aria-hidden="true" className="size-3.5" />
            Thêm cột
          </button>
        </div>

        {/* Collapsible AI Goal Panel */}
        {showAiPanel && (
          <div className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-2.5 sm:flex-row sm:items-center">
            <input
              aria-label="Mục tiêu thu thập của doanh nghiệp"
              value={goal}
              disabled={Boolean(busy)}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Nhập ngành hàng / nhu cầu cần thu thập (VD: Đặt lịch nha khoa)…"
              className={fieldInputClass}
            />
            <button
              type="button"
              disabled={Boolean(busy) || !goal.trim()}
              onClick={() => void handleSuggest()}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-medium text-on-primary hover:opacity-90 disabled:opacity-50"
            >
              {busy === "suggest" ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Sparkles aria-hidden="true" className="size-3.5" />}
              {busy === "suggest" ? "Đang tạo…" : "Tạo bộ cột"}
            </button>
          </div>
        )}

        {/* Simple compact spreadsheet-style column list */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-on-surface-variant">
            <Loader2 aria-hidden="true" className="size-4 animate-spin text-primary" />
            Đang tải cấu hình cột…
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
            <div className="hidden grid-cols-[28px_1fr_144px_72px_96px] items-center gap-2 border-b border-outline-variant bg-surface-container-low px-3 py-2 text-xs font-medium text-on-surface-variant sm:grid">
              <span className="text-center">#</span>
              <span>Tên cột ({fields.length}/30)</span>
              <span>Kiểu dữ liệu</span>
              <span className="text-center">Bot hỏi</span>
              <span className="text-right">Thao tác</span>
            </div>

            <div className="max-h-80 divide-y divide-outline-variant overflow-y-auto">
              {fields.length === 0 ? (
                <div className="p-4 text-center text-xs text-on-surface-variant text-pretty">
                  Chưa có cột tùy chỉnh. Bấm <strong>Thêm cột</strong> để tạo cột mới hoặc lưu để chỉ dùng cột mặc định.
                </div>
              ) : fields.map((field, index) => {
                const isLastRow = index === fields.length - 1;
                const isFocusedRow = Boolean(focusFieldKey && field.key === focusFieldKey);
                const needsOptions = field.type === "single_select" || field.type === "multi_select";
                return (
                  <div key={field._localId} className="space-y-2 px-3 py-2">
                    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[28px_1fr_144px_72px_96px]">
                      <span className="hidden text-center text-xs tabular-nums text-on-surface-variant sm:block">
                        {index + 1}
                      </span>
                      <input
                        ref={isFocusedRow ? focusedLabelInputRef : isLastRow ? newLabelInputRef : undefined}
                        aria-label={`Tên cột ${index + 1}`}
                        value={field.label}
                        disabled={Boolean(busy)}
                        onChange={(event) => updateField(field._localId, { label: event.target.value })}
                        placeholder={`Tên cột ${index + 1} (VD: Nhu cầu, Ngân sách…)`}
                        className={fieldInputClass}
                      />
                      <StyledSelect
                        ariaLabel={`Kiểu dữ liệu cột ${index + 1}`}
                        value={field.type}
                        disabled={Boolean(busy)}
                        options={fieldTypeSelectOptions}
                        onChange={(next) => {
                          const nextType = next as LeadIntakeFieldType;
                          updateField(field._localId, {
                            type: nextType,
                            options: (nextType === "single_select" || nextType === "multi_select")
                              ? (field.options.length >= 2 ? field.options : ["Lựa chọn 1", "Lựa chọn 2"])
                              : [],
                          });
                        }}
                        className="h-9 rounded-xl text-xs"
                      />
                      <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 text-xs text-on-surface">
                        <input
                          type="checkbox"
                          checked={field.required}
                          disabled={Boolean(busy)}
                          onChange={(event) => updateField(field._localId, { required: event.target.checked })}
                          className="size-4 accent-primary"
                        />
                        <span className="sm:sr-only">Bot hỏi</span>
                      </label>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          disabled={Boolean(busy) || index === 0}
                          aria-label={`Di chuyển cột ${index + 1} lên`}
                          onClick={() => moveField(index, -1)}
                          className="inline-flex size-7 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-1 focus-visible:outline-primary disabled:opacity-40"
                        >
                          <ArrowUp aria-hidden="true" className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busy) || index === fields.length - 1}
                          aria-label={`Di chuyển cột ${index + 1} xuống`}
                          onClick={() => moveField(index, 1)}
                          className="inline-flex size-7 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-low focus-visible:outline-1 focus-visible:outline-primary disabled:opacity-40"
                        >
                          <ArrowDown aria-hidden="true" className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          aria-label={`Xóa cột ${field.label || index + 1}`}
                          onClick={() => setFields(current => current.filter(item => item._localId !== field._localId))}
                          className="inline-flex size-7 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-error-container hover:text-error focus-visible:outline-1 focus-visible:outline-primary disabled:opacity-40"
                        >
                          <Trash2 aria-hidden="true" className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {needsOptions && (
                      <div className="sm:pl-9">
                        <input
                          aria-label={`Lựa chọn cho cột ${field.label || index + 1}`}
                          value={field.options.join(", ")}
                          disabled={Boolean(busy)}
                          onChange={(event) => updateField(field._localId, {
                            options: event.target.value.split(",").slice(0, 30),
                          })}
                          placeholder="Các lựa chọn cách nhau bằng dấu phẩy (VD: Gói cơ bản, Gói nâng cao)"
                          className={fieldInputClass}
                        />
                      </div>
                    )}

                    {showBotQuestions && (
                      <div className="sm:pl-9">
                        <input
                          aria-label={`Câu hỏi chatbot cho cột ${field.label || index + 1}`}
                          value={field.question}
                          disabled={Boolean(busy)}
                          onChange={(event) => updateField(field._localId, { question: event.target.value })}
                          placeholder={field.label.trim() ? defaultBotQuestion(field.label, field.type) : "Câu hỏi bot tự tạo theo tên cột"}
                          className={fieldInputClass}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowBotQuestions(current => !current)}
            className="text-primary hover:underline focus-visible:outline-1 focus-visible:outline-primary"
          >
            {showBotQuestions ? "Ẩn tùy chỉnh câu hỏi Bot" : "Tùy chỉnh câu hỏi Bot & lời nhắn…"}
          </button>
          <span className="text-on-surface-variant">Tự động lưu cho Lead Sheet và Chatbot.</span>
        </div>

        {showBotQuestions && (
          <div className="space-y-1">
            <label htmlFor="intake-completion-msg" className="block text-xs text-on-surface-variant">
              Lời nhắn khi Bot đã thu thập đủ thông tin
            </label>
            <input
              id="intake-completion-msg"
              value={completionMessage}
              disabled={Boolean(busy) || loading}
              onChange={(event) => setCompletionMessage(event.target.value)}
              className={fieldInputClass}
            />
          </div>
        )}

        {error && <p role="alert" className="rounded-xl border border-error/30 bg-error-container px-3 py-2 text-xs text-on-error-container">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-primary/20 bg-primary-fixed px-3 py-2 text-xs text-on-primary-fixed">{notice}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant pt-3">
          <button type="button" disabled={Boolean(busy)} onClick={onClose} className={secondaryBtnClass}>Hủy</button>
          <button type="submit" disabled={Boolean(busy) || loading} className={primaryCreateButtonClass}>
            {busy === "save" && <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />}
            {busy === "save" ? "Đang lưu…" : fields.length === 0 ? "Gỡ bộ cột" : "Lưu & Áp dụng cho Chatbot"}
          </button>
        </div>
      </form>
    </ErpModal>
  );
};
