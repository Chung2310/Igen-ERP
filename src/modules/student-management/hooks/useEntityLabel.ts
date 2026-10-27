import { useEffect, useSyncExternalStore } from "react";
import { ENTITY_LABEL_PRESETS, LOADING_ENTITY_LABELS, type EntityLabelSet, type EntityPreset } from "../config/entityLabels";
import {
  ensureEntityPresetLoaded,
  getEntityPresetSnapshot,
  subscribeEntityPreset,
  retryEntityPresetLoad,
} from "./entityPresetStore";

export type UseEntityLabelResult = EntityLabelSet & {
  preset: EntityPreset;
  loading: boolean;
  error?: string;
  retry?: () => Promise<void>;
};

export function useEntityLabel(loadSettings = true): UseEntityLabelResult {
  const snapshot = useSyncExternalStore(
    subscribeEntityPreset,
    getEntityPresetSnapshot,
    getEntityPresetSnapshot,
  );

  useEffect(() => {
    if (loadSettings) void ensureEntityPresetLoaded();
  }, [loadSettings]);

  return {
    ...(snapshot.loading ? LOADING_ENTITY_LABELS : ENTITY_LABEL_PRESETS[snapshot.preset]),
    preset: snapshot.preset,
    loading: snapshot.loading,
    error: snapshot.error,
    retry: retryEntityPresetLoad,
  };
}
