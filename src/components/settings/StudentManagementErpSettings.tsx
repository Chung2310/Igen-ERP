import React from "react";
import { useAuth } from "../../context/AuthContext";
import { isModuleEnabled, MODULE_OPTIONS } from "../../config/modules";

export default function StudentManagementErpSettings() {
  const { userProfile } = useAuth();
  const enabled = MODULE_OPTIONS.filter((option) => option.moduleKeys.some((key) => isModuleEnabled(userProfile?.enabledModules, key)));
  return (
    <section className="rounded-xl border border-outline-variant bg-surface p-4">
      <h3 className="text-balance text-sm font-bold text-on-surface">Module được kích hoạt</h3>
      <p className="mt-2 text-pretty text-sm text-on-surface/70">Mỗi module có mục menu riêng. Liên hệ quản trị hệ thống để thay đổi module được kích hoạt.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {enabled.map((option) => <li key={option.key} className="text-sm text-on-surface">{option.label}</li>)}
      </ul>
    </section>
  );
}
