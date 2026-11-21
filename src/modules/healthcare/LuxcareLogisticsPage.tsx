import { Suspense, lazy, type ComponentType } from "react";
import { ModuleNavigation, ModuleNavigationButton } from "../../components/common/ModuleNavigation";
import { useAuth } from "../../context/AuthContext";
import { navigateHealthcareSub } from "./navigation";
import HealthcareSidebarIcon from "./HealthcareSidebarIcon";

const modules = import.meta.glob("../../../healthcare-luxcare/src/pages/{SupplyTab,EquipmentTab}.tsx");
const loadPage = (name: "SupplyTab" | "EquipmentTab") =>
  modules[`../../../healthcare-luxcare/src/pages/${name}.tsx`]() as Promise<{ default: ComponentType }>;
const SupplyTab = lazy(() => loadPage("SupplyTab"));
const EquipmentTab = lazy(() => loadPage("EquipmentTab"));

const clinicalTabs = [
  ["benh-nhan", "Bệnh nhân", "healthcare", "patients"],
  ["luot-kham", "Lượt khám", "healthcare-visits", "visits"],
  ["lich-hen", "Lịch hẹn", "healthcare-appointments", "appointments"],
  ["cham-soc", "Chăm sóc", "healthcare-care", "care"],
  ["danh-muc", "Danh mục", "healthcare-settings", "settings"],
] as const;

export default function LuxcareLogisticsPage({ section }: { section: "vat-tu" | "thiet-bi" }) {
  const { hasPermission } = useAuth();
  const go = navigateHealthcareSub;
  return <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface text-on-surface">
    <h1 className="sr-only">Quản lý y tế - {section === "vat-tu" ? "Vật tư" : "Thiết bị"}</h1>
    <ModuleNavigation label="Nghiệp vụ y tế" activeValue={section} className="mb-2 lg:mb-0">
      {clinicalTabs.filter(([, , feature]) => hasPermission(`${feature}:read`) || hasPermission(`${feature}:manage`)).map(([sub, label, , kind]) =>
        <ModuleNavigationButton key={sub} active={false} icon={<HealthcareSidebarIcon kind={kind} className="text-primary" />}
          preferProvidedIcon onClick={() => go(sub)}>{label}</ModuleNavigationButton>)}
      {(hasPermission("healthcare:read") || hasPermission("healthcare:manage") || hasPermission("healthcare-supplies:read") || hasPermission("healthcare-supplies:manage")) &&
        <ModuleNavigationButton active={section === "vat-tu"} icon={<HealthcareSidebarIcon kind="supplies" className="text-primary" />} preferProvidedIcon onClick={() => go("vat-tu")}>Vật tư</ModuleNavigationButton>}
      {(hasPermission("healthcare:read") || hasPermission("healthcare:manage") || hasPermission("healthcare-equipment:read") || hasPermission("healthcare-equipment:manage")) &&
        <ModuleNavigationButton active={section === "thiet-bi"} icon={<HealthcareSidebarIcon kind="equipment" className="text-primary" />} preferProvidedIcon onClick={() => go("thiet-bi")}>Thiết bị</ModuleNavigationButton>}
    </ModuleNavigation>
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="min-h-full min-w-0 rounded-md bg-surface-container-lowest shadow-xs">
        <Suspense fallback={<p role="status" className="p-4 text-sm text-on-surface-variant">Đang tải phân hệ…</p>}>
          {section === "vat-tu" ? <SupplyTab /> : <EquipmentTab />}
        </Suspense>
      </div>
    </div>
  </div>;
}
