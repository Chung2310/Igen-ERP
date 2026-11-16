import { useCallback, useMemo, useState } from "react";
import { getAssistantSpeechHistoryUserId } from "../../services/assistantSpeechHistory";

export type AssistantStudioStyleLibrary = "create-image" | "edit-image";

function getStorageKey(library: AssistantStudioStyleLibrary) {
  let userId = "browser";
  try {
    if (typeof localStorage !== "undefined") userId = getAssistantSpeechHistoryUserId();
  } catch { /* Keep favorites available when storage is unavailable. */ }
  return `igen_erp_ai_studio_style_favorites:${userId}:${library}`;
}

function readFavorites(storageKey: string): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]") as unknown;
    return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function prioritizeAssistantStudioStyles<T extends { id: string }>(styles: readonly T[], favoriteIds: readonly string[]): T[] {
  const favorites = new Set(favoriteIds);
  return [
    ...styles.filter(style => favorites.has(style.id)),
    ...styles.filter(style => !favorites.has(style.id)),
  ];
}

export function useAssistantStudioStyleFavorites(library: AssistantStudioStyleLibrary) {
  const storageKey = useMemo(() => getStorageKey(library), [library]);
  const [favoriteIds, setFavoriteIds] = useState(() => readFavorites(storageKey));
  const toggleFavorite = useCallback((styleId: string) => {
    setFavoriteIds(current => {
      const next = current.includes(styleId)
        ? current.filter(id => id !== styleId)
        : [...current, styleId];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the current session usable. */ }
      return next;
    });
  }, [storageKey]);

  return { favoriteIds, toggleFavorite };
}
