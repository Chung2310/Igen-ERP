import { useEffect, useState } from "react";
import { Building2, RefreshCw } from "lucide-react";
import { toast } from "../../pages/Toast";
import { getModuleSettings, updateModuleSettings } from "../../modules/student-management/api/moduleSettings.api";
import {
  DEFAULT_ENTITY_PRESET,
  ENTITY_PRESET_OPTIONS,
  type EntityPreset,
} from "../../modules/student-management/config/entityLabels";

export default function StudentManagementErpSettings() {
  const [entityPreset, setEntityPreset] = useState<EntityPreset>(DEFAULT_ENTITY_PRESET);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    getModuleSettings()
      .then((settings) => {
        if (mounted) setEntityPreset(settings.entityPreset);
      })
      .catch((error) => {
        console.error("Không thể tải cấu hình học viên/lao động:", error);
        toast.error("Không thể tải cấu hình học viên/lao động.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const selectPreset = async (nextPreset: EntityPreset) => {
    if (saving || nextPreset === entityPreset) return;
    setSaving(true);
    try {
      const updated = await updateModuleSettings(nextPreset);
      setEntityPreset(updated.entityPreset);
      window.dispatchEvent(new CustomEvent("entity-label:changed", {
        detail: { entityPreset: updated.entityPreset },
      }));
      toast.success("Đã cập nhật cấu hình học viên/lao động.");
    } catch (error) {
      console.error("Không thể lưu cấu hình học viên/lao động:", error);
      toast.error("Không thể lưu cấu hình học viên/lao động.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Building2 className="h-4 w-4 text-cyan-600" />
          Cấu hình học viên / lao động
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Chọn loại đối tượng để hệ thống đồng bộ tên gọi và quy trình nghiệp vụ.
        </p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" /> Đang tải cấu hình...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ENTITY_PRESET_OPTIONS.map((option) => {
            const selected = option.value === entityPreset;
            return (
              <button key={option.value} type="button" disabled={saving}
                onClick={() => selectPreset(option.value)}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${selected ? "border-cyan-500 bg-cyan-50 text-cyan-800" : "border-slate-200 text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/40"}`}>
                {option.label}{selected && <span className="ml-2 text-[10px] uppercase text-cyan-600">Đang dùng</span>}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
