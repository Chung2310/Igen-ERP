import { useEffect, useState } from "react";
import { Building2, Lock, RefreshCw } from "lucide-react";
import { toast } from "../../pages/Toast";
import { getModuleSettings } from "../../modules/student-management/api/moduleSettings.api";
import {
  DEFAULT_ENTITY_PRESET,
  getEntityPresetOptions,
  type EntityPreset,
} from "../../modules/student-management/config/entityLabels";

/**
 * Chỉ-đọc: loại hình doanh nghiệp (entityPreset) là đặc quyền SuperAdmin.
 * Doanh nghiệp xem được mình đang ở loại hình nào nhưng không tự sửa.
 */
export default function StudentManagementErpSettings() {
  const [entityPreset, setEntityPreset] = useState<EntityPreset>(DEFAULT_ENTITY_PRESET);
  const [loading, setLoading] = useState(true);

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

  const options = getEntityPresetOptions(entityPreset);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Building2 className="h-4 w-4 text-cyan-600" />
          Loại hình doanh nghiệp
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Loại đối tượng quyết định tên gọi và quy trình nghiệp vụ của hệ thống.
        </p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" /> Đang tải cấu hình...
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {options.map((option) => {
            const active = option.value === entityPreset;
            return (
              <div
                key={option.value}
                aria-disabled
                aria-current={active ? "true" : undefined}
                title={
                  active
                    ? "Loại hình doanh nghiệp đang áp dụng"
                    : "Chỉ SuperAdmin đổi được loại hình doanh nghiệp"
                }
                className={
                  active
                    ? "cursor-not-allowed rounded-xl border-2 border-cyan-500 bg-cyan-50 px-4 py-3 shadow-sm ring-2 ring-cyan-200"
                    : "cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 opacity-60"
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={
                      active ? "text-sm font-bold text-cyan-800" : "text-sm font-semibold text-slate-500"
                    }
                  >
                    {option.label}
                  </div>
                  {active ? null : <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />}
                </div>
                <div
                  className={
                    active
                      ? "mt-1 text-[10px] font-bold uppercase tracking-wide text-cyan-600"
                      : "mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                  }
                >
                  {active ? "Đang dùng" : "Đã khoá"}
                  {option.legacy ? " • Loại hình cũ" : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
        <Lock className="h-3 w-3" />
        Chỉ SuperAdmin thay đổi được loại hình doanh nghiệp. Cần đổi, vui lòng liên hệ quản trị hệ thống.
      </p>
    </section>
  );
}
