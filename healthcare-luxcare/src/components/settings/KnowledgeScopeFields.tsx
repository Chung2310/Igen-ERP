import { useEffect, useState } from "react";
import { getKnowledgeScopes, type KnowledgeScope } from "../../services/assistantKnowledgeService";
export const companyScope: KnowledgeScope = { visibility: "company", branchIds: [], departmentIds: [] };
export default function KnowledgeScopeFields({
  value,
  onChange,
}: {
  value: KnowledgeScope;
  onChange: (scope: KnowledgeScope) => void;
}) {
  const [options, setOptions] = useState<{ branches: any[]; departments: any[] }>({ branches: [], departments: [] });
  const [error, setError] = useState("");
  useEffect(() => {
    if (value.visibility !== "restricted") return;
    let active = true;
    getKnowledgeScopes()
      .then((data) => {
        if (active) setOptions(data);
      })
      .catch(() => {
        if (active) setError("Không thể tải chi nhánh và phòng ban.");
      });
    return () => {
      active = false;
    };
  }, [value.visibility]);
  return (
    <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm">
      <legend>Phạm vi đọc tài liệu</legend>
      <select
        aria-label="Phạm vi đọc tài liệu"
        value={value.visibility}
        onChange={(e) => onChange({ ...value, visibility: e.target.value as KnowledgeScope["visibility"] })}
        className="w-full rounded-lg border p-2"
      >
        <option value="company">Toàn doanh nghiệp</option>
        <option value="restricted">Giới hạn chi nhánh / phòng ban</option>
      </select>
      {value.visibility === "restricted" && (
        <>
          <p className="text-xs text-slate-500">
            Chọn ít nhất một phạm vi. Nếu chọn cả hai, người đọc cần thuộc cả chi nhánh và phòng ban đã chọn. Quản trị
            viên doanh nghiệp có thể đọc mọi tài liệu.
          </p>
          {error && (
            <p role="alert" className="text-rose-600">
              {error}
            </p>
          )}
          {(
            [
              ["branchIds", "branches", "Chi nhánh"],
              ["departmentIds", "departments", "Phòng ban"],
            ] as const
          ).map(([field, list, label]) => (
            <label key={field} className="block">
              {label}
              <select
                multiple
                aria-label={label}
                value={value[field]}
                onChange={(e) =>
                  onChange({ ...value, [field]: Array.from(e.target.selectedOptions, (option) => option.value) })
                }
                className="mt-1 w-full rounded-lg border p-2"
              >
                {options[list].map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </>
      )}
    </fieldset>
  );
}
