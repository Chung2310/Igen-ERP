import { useEffect, useState } from "react";
import { pathToTab, tabToPath } from "../seo/seo-config";
import type { TabType } from "../types";
import { DEFAULT_APP_TAB } from "./route-config";

function resolveInitialTab() {
  return pathToTab(window.location.pathname) || DEFAULT_APP_TAB;
}

export function useTabRouter() {
  const [activeTab, setActiveTab] = useState<TabType>(resolveInitialTab);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(pathToTab(window.location.pathname) || DEFAULT_APP_TAB);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const nextPath = tabToPath(activeTab);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
  }, [activeTab]);

  return {
    activeTab,
    setActiveTab,
  };
}
