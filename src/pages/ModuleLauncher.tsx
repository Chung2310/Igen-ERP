import { LockKeyhole } from "lucide-react";
import { ModuleArtwork } from "../components/common/ModuleArtwork";
import { ModuleLauncherLogo } from "../components/common/ModuleLauncherLogo";
import { useAuth } from "../context/AuthContext";
import { tabToPath } from "../seo/seo-config";
import { subTabToSlug } from "../router/subTabRoutes";
import type { TabType } from "../types";
import Header from "./Header";
import { getAvailableMenuItems } from "./Sidebar";
import "./ModuleLauncher.css";

export default function ModuleLauncher() {
  const { userProfile, hasPermission } = useAuth();
  const groupOrder = ["main", "operations", "marketing", "subscription", "tools", "system"];
  const items = getAvailableMenuItems(userProfile, hasPermission)
    .sort((first, second) => groupOrder.indexOf(first.group) - groupOrder.indexOf(second.group));
  const navigateFromHeader = (tab: TabType, subTab?: string) => {
    const destination = new URL(tabToPath(tab), window.location.origin);
    const slug = subTab ? subTabToSlug(tab, subTab) : "";
    if (slug) destination.searchParams.set("sub", slug);
    window.location.assign(`${destination.pathname}${destination.search}`);
  };

  return (
    <main className="module-launcher min-h-dvh text-on-background">
      <div className="mb-5 border-b border-outline-variant sm:mb-6">
        <div className="flex items-center justify-between gap-4 px-3 pb-3 pt-3 sm:px-6 sm:pt-4">
          <ModuleLauncherLogo />
          <Header variant="launcher" currentTab="TỔNG QUAN" onSearchSelect={navigateFromHeader} />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 pb-10 sm:px-6">
        <h1 className="sr-only">Chọn phân hệ</h1>
        <ul className="mx-auto grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:max-w-240 lg:grid-cols-6 lg:gap-x-4 lg:gap-y-4">
          {items.map((item) => (
            <li key={item.label}>
              {item.locked ? (
                <div className="flex min-h-28 flex-col items-center p-1 text-center">
                  <span className="flex size-18 items-center justify-center p-2 grayscale"><ModuleArtwork module={item.label} className="size-full" /></span>
                  <span className="mt-1.5 flex w-max max-w-40 items-center justify-center gap-1 text-sm font-medium leading-snug text-on-surface-variant" title={item.title}><span className="min-w-0 truncate">{item.title}</span><span className="sr-only">, chưa được cấp quyền</span><LockKeyhole className="size-3 shrink-0" aria-hidden="true" /></span>
                </div>
              ) : (
                <a href={tabToPath(item.label)} className="module-launcher-card flex min-h-28 flex-col items-center p-1 text-center focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <span className="module-launcher-icon-tile relative flex size-18 items-center justify-center">
                    <ModuleArtwork module={item.label} className="size-full" />
                    {item.label === "TRỢ LÝ AI" && (
                      <span aria-hidden="true" className="module-launcher-new-badge pointer-events-none absolute -right-3 -top-2 rounded-full px-2 py-1 text-xs font-semibold leading-none text-white shadow-sm">
                        Mới
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 w-max max-w-40 truncate text-sm font-semibold leading-snug text-on-surface" title={item.title}>{item.title}</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
