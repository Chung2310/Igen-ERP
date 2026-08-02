import {
  ENTITY_LABEL_PRESETS,
  type EntityLabelSet,
  type EntityPreset,
} from "../config/entityLabels";

export type UseEntityLabelResult = EntityLabelSet & {
  preset: EntityPreset;
  loading: boolean;
};

export function useEntityLabel(_loadSettings = true): UseEntityLabelResult {
  return {
    ...ENTITY_LABEL_PRESETS.worker,
    preset: "worker",
    loading: false,
  };
}
