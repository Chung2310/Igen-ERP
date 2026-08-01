import { useEffect, useSyncExternalStore } from "react";
import { ENTITY_LABEL_PRESETS, LOADING_ENTITY_LABELS, type EntityLabelSet, type EntityPreset } from "../config/entityLabels";
import {
  ensureEntityPresetLoaded,
  getEntityPresetSnapshot,
  subscribeEntityPreset,
} from "./entityPresetStore";

export type UseEntityLabelResult = EntityLabelSet & {
  preset: EntityPreset;
  loading: boolean;
};

export function useEntityLabel(): UseEntityLabelResult {
  const snapshot = useSyncExternalStore(
    subscribeEntityPreset,
    getEntityPresetSnapshot,
    getEntityPresetSnapshot,
  );

  useEffect(() => {
    void ensureEntityPresetLoaded();
  }, []);

  return {
    ...(snapshot.loading ? LOADING_ENTITY_LABELS : ENTITY_LABEL_PRESETS[snapshot.preset]),
    preset: snapshot.preset,
    loading: snapshot.loading,
  };
}
