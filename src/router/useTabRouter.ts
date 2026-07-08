import { useEffect, useState } from "react";
import { pathToTab, tabToPath } from "../seo/seo-config";
import type { TabType } from "../types";
import { DEFAULT_APP_TAB } from "./route-config";

function resolveInitialTab() {
  const tab = pathToTab(window.location.pathname) || DEFAULT_APP_TAB;
  console.log(`[useTabRouter] resolveInitialTab: pathname="${window.location.pathname}", resolvedTab="${tab}"`);
  return tab;
}

function isAppTabPath(pathname: string) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return normalized === "/" || Boolean(pathToTab(normalized));
}

export function useTabRouter(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [activeTab, setActiveTab] = useState<TabType>(resolveInitialTab);

  console.log(`[useTabRouter] Render: activeTab="${activeTab}", enabled=${enabled}, pathname="${window.location.pathname}"`);

  // Sync tab state when router becomes enabled (e.g. after auth loading finishes)
  useEffect(() => {
    if (enabled) {
      const currentTab = pathToTab(window.location.pathname) || DEFAULT_APP_TAB;
      if (activeTab !== currentTab) {
        console.log(`[useTabRouter] Syncing activeTab from path: pathname="${window.location.pathname}", tab="${currentTab}"`);
        setActiveTab(currentTab);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const handlePopState = () => {
      const tab = pathToTab(window.location.pathname) || DEFAULT_APP_TAB;
      console.log(`[useTabRouter] handlePopState: pathname="${window.location.pathname}", resolvedTab="${tab}"`);
      setActiveTab(tab);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    if (!isAppTabPath(window.location.pathname)) {
      return;
    }

    const nextPath = tabToPath(activeTab);
    console.log(`[useTabRouter] Sync Path Effect: activeTab="${activeTab}", currentPath="${window.location.pathname}", nextPath="${nextPath}"`);
    if (window.location.pathname !== nextPath) {
      console.log(`[useTabRouter] Pushing state to nextPath="${nextPath}"`);
      window.history.pushState(null, "", nextPath);
    }
  }, [activeTab, enabled]);

  return {
    activeTab,
    setActiveTab,
  };
}
