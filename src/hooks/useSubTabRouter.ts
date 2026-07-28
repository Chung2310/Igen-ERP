import { useState, useEffect, useCallback } from "react";

export type SubTabRouteMap<T extends string> = Array<{
  slug: string;
  value: T;
}>;

/**
 * Syncs a sub-tab state to the browser URL via the `?sub=` query parameter.
 * - On mount: reads ?sub= from URL and resolves to matching tab value (or default).
 * - On tab change: calls replaceState to update ?sub= without reloading or adding history entries.
 *
 * @param routeMap  Array of { slug, value } pairs mapping URL slugs to sub-tab values.
 * @param defaultValue  The default tab value when no matching ?sub= is found.
 */
export function useSubTabRouter<T extends string>(
  routeMap: SubTabRouteMap<T>,
  defaultValue: T
): [T, (tab: T) => void] {
  const resolveFromUrl = useCallback((): T => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("sub");
    if (!slug) return defaultValue;
    const match = routeMap.find((entry) => entry.slug === slug);
    return match ? match.value : defaultValue;
  }, [routeMap, defaultValue]);

  const [activeSubTab, setActiveSubTabState] = useState<T>(resolveFromUrl);

  const replaceSubTabInUrl = useCallback(
    (tab: T) => {
      const match = routeMap.find((entry) => entry.value === tab);
      const url = new URL(window.location.href);
      if (match) {
        url.searchParams.set("sub", match.slug);
      } else {
        url.searchParams.delete("sub");
      }
      window.history.replaceState(null, "", url.toString());
    },
    [routeMap],
  );

  const isStateValid = routeMap.some((entry) => entry.value === activeSubTab);
  const resolvedActiveSubTab = isStateValid ? activeSubTab : defaultValue;

  // Sync URL → state when the page is loaded (handles F5, direct link)
  useEffect(() => {
    const resolvedFromUrl = resolveFromUrl();
    setActiveSubTabState(resolvedFromUrl);
    replaceSubTabInUrl(resolvedFromUrl);
  }, [replaceSubTabInUrl, resolveFromUrl]);

  useEffect(() => {
    if (activeSubTab === resolvedActiveSubTab) return;
    setActiveSubTabState(resolvedActiveSubTab);
    replaceSubTabInUrl(resolvedActiveSubTab);
  }, [activeSubTab, replaceSubTabInUrl, resolvedActiveSubTab]);

  // Sync URL → state when popstate fires (handles browser back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      setActiveSubTabState(resolveFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [resolveFromUrl]);

  const setActiveSubTab = useCallback(
    (tab: T) => {
      setActiveSubTabState(tab);
      replaceSubTabInUrl(tab);
    },
    [replaceSubTabInUrl]
  );

  return [resolvedActiveSubTab, setActiveSubTab];
}
