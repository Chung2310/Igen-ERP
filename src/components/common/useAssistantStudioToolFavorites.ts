import { useCallback, useMemo, useState } from "react";
import { getAssistantSpeechHistoryUserId } from "../../services/assistantSpeechHistory";

function getStorageKey() {
  let userId = "browser";
  try {
    if (typeof localStorage !== "undefined") userId = getAssistantSpeechHistoryUserId();
  } catch { /* Keep favorites available when storage is unavailable. */ }
  return `igen_erp_ai_studio_tool_favorites:${userId}`;
}

function readFavorites(storageKey: string): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]") as unknown;
    return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function useAssistantStudioToolFavorites() {
  const storageKey = useMemo(getStorageKey, []);
  const [favoriteIds, setFavoriteIds] = useState(() => readFavorites(storageKey));
  const toggleFavorite = useCallback((toolId: string) => {
    const next = favoriteIds.includes(toolId)
      ? favoriteIds.filter(id => id !== toolId)
      : [...favoriteIds, toolId];
    setFavoriteIds(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the current session usable. */ }
  }, [favoriteIds, storageKey]);

  return { favoriteIds, toggleFavorite };
}
