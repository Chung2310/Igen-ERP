import { useEffect, useState } from "react";
import { getModuleSettings } from "../api/moduleSettings.api";
import { DEFAULT_ENTITY_PRESET, ENTITY_LABEL_PRESETS, type EntityLabelSet, type EntityPreset } from "../config/entityLabels";
import { socketService } from "../../../services/socketService";

export type UseEntityLabelResult = EntityLabelSet & {
  preset: EntityPreset;
  loading: boolean;
};

export function useEntityLabel(): UseEntityLabelResult {
  const [preset, setPreset] = useState<EntityPreset>(DEFAULT_ENTITY_PRESET);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const settings = await getModuleSettings();
        if (mounted) setPreset(settings.entityPreset);
      } catch {
        if (mounted) setPreset(DEFAULT_ENTITY_PRESET);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();

    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ entityPreset?: EntityPreset }>).detail;
      if (detail?.entityPreset) {
        setPreset(detail.entityPreset);
      } else {
        void load();
      }
    };
    window.addEventListener("entity-label:changed", onChanged);

    const offSocket = socketService.on("entity_preset_changed", (data: { entityPreset?: EntityPreset }) => {
      if (data?.entityPreset) setPreset(data.entityPreset);
    });

    return () => {
      mounted = false;
      window.removeEventListener("entity-label:changed", onChanged);
      offSocket();
    };
  }, []);

  return { ...ENTITY_LABEL_PRESETS[preset], preset, loading };
}
