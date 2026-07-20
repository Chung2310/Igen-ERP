import { useMemo, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { canManageCustomFields } from "./permissions";
import { CustomFieldEditorModal } from "./CustomFieldEditorModal";
import { CustomFieldRenderer } from "./CustomFieldRenderer";
import type { CreateFieldInput, CustomFieldValues, FieldDefinition, ModuleKey } from "./types";
import { useCustomFields } from "./useCustomFields";

export type CustomFieldsSectionProps = {
  moduleKey: ModuleKey;
  values: CustomFieldValues;
  onChange(values: CustomFieldValues): void;
  errors?: Record<string, string | undefined>;
  mode: "create" | "edit";
  disabled?: boolean;
  tenantId?: string;
};

export function CustomFieldsSection({ moduleKey, values, onChange, errors = {}, mode, disabled = false, tenantId }: CustomFieldsSectionProps) {
  const { userProfile } = useAuth();
  const { fields, archivedFields, loading, error, refresh, createField, updateField, archiveField, restoreField, deleteField } = useCustomFields(moduleKey, tenantId);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FieldDefinition | null>(null);
  const manageable = canManageCustomFields(userProfile?.role);
  const activeFields = useMemo(() => [...fields].filter((field) => !field.isArchived && field.isVisible).sort((left, right) => left.order - right.order), [fields]);

  const openCreate = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (field: FieldDefinition) => { setEditing(field); setEditorOpen(true); };
  const submit = async (input: CreateFieldInput) => {
    if (editing) await updateField(editing.id, input);
    else await createField(input);
  };
  const archive = async (field: FieldDefinition) => {
    if (!window.confirm(`Lưu trữ trường “${field.label}”? Dữ liệu hiện có sẽ được giữ lại.`)) return;
    await archiveField(field.id);
  };
  const remove = async (field: FieldDefinition) => {
    if (!window.confirm(`Xóa vĩnh viễn trường “${field.label}”? Dữ liệu liên quan đến trường này trên tất cả hồ sơ cũng sẽ bị mất.`)) return;
    await deleteField(field.id);
  };

  return (
    <section className="pt-4 border-t border-slate-100 space-y-4" aria-label="Trường tùy chỉnh" data-mode={mode}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Thông tin bổ sung</h3>
        {manageable ? (
          <button
            type="button"
            disabled={disabled}
            onClick={openCreate}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all disabled:opacity-50"
          >
            + Thêm trường
          </button>
        ) : null}
      </div>
      {error ? <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button type="button" className="font-semibold underline" onClick={() => void refresh()}>Thử lại</button></div> : null}
      {loading && !fields.length ? <p aria-live="polite" className="text-sm text-slate-500">Đang tải trường tùy chỉnh…</p> : null}
      <div className="space-y-4">
        {activeFields.map((field) => (
          <div key={field.id} className="relative space-y-1">
            {manageable ? (
              <div className="absolute right-0 top-0 z-10 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 opacity-60 hover:opacity-100 transition-opacity">
                <button type="button" disabled={disabled} aria-label={`Chỉnh sửa ${field.label}`} title="Chỉnh sửa" className="hover:text-cyan-600 transition-colors" onClick={() => openEdit(field)}>Sửa</button>
                <span>|</span>
                <button type="button" disabled={disabled} aria-label={`Lưu trữ ${field.label}`} title="Lưu trữ" className="hover:text-cyan-600 transition-colors" onClick={() => void archive(field)}>Lưu trữ</button>
                <span>|</span>
                <button type="button" disabled={disabled} aria-label={`Xóa ${field.label}`} title="Xóa" className="text-rose-500 hover:text-rose-600 transition-colors" onClick={() => void remove(field)}>Xóa</button>
              </div>
            ) : null}
            <CustomFieldRenderer field={field} value={values[field.key] ?? (mode === "create" ? field.defaultValue : undefined)} onChange={(value) => onChange({ ...values, [field.key]: value })} error={errors[field.key]} disabled={disabled} />
          </div>
        ))}
      </div>
      {manageable && archivedFields.length ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trường đã lưu trữ</h4>
          <ul className="mt-2 divide-y divide-slate-100">
            {archivedFields.map((field) => (
              <li key={field.id} className="flex items-center justify-between py-2 text-xs text-slate-600">
                <span>{field.label}</span>
                <button
                  type="button"
                  disabled={disabled}
                  className="font-bold text-cyan-600 hover:text-cyan-700 disabled:opacity-50 transition-colors"
                  aria-label={`Khôi phục ${field.label}`}
                  onClick={() => void restoreField(field.id)}
                >
                  Khôi phục
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <CustomFieldEditorModal open={editorOpen} moduleKey={moduleKey} initialField={editing} onClose={() => setEditorOpen(false)} onSubmit={submit} />
    </section>
  );
}
