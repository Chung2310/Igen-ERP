import { getModuleSettings } from "../api/moduleSettings.api";
import {
  DEFAULT_ENTITY_PRESET,
  ENTITY_PRESETS,
  type EntityPreset,
} from "../config/entityLabels";
import { socketService } from "../../../services/socketService";

export type EntityPresetSnapshot = {
  preset: EntityPreset;
  loading: boolean;
};

const initialSnapshot: EntityPresetSnapshot = {
  preset: DEFAULT_ENTITY_PRESET,
  loading: true,
};

let snapshot = initialSnapshot;
let loadPromise: Promise<void> | null = null;
let removeSocketListener: (() => void) | null = null;
const subscribers = new Set<() => void>();

function publish(nextSnapshot: EntityPresetSnapshot) {
  snapshot = nextSnapshot;
  subscribers.forEach((listener) => listener());
}

function isEntityPreset(value: unknown): value is EntityPreset {
  return typeof value === "string" && (ENTITY_PRESETS as readonly string[]).includes(value);
}

export function getEntityPresetSnapshot(): EntityPresetSnapshot {
  return snapshot;
}

function handleBrowserPresetChange(event: Event) {
  const detail = (event as CustomEvent<{ entityPreset?: EntityPreset }>).detail;
  if (setEntityPreset(detail?.entityPreset)) return;

  publish({ ...snapshot, loading: true });
  void ensureEntityPresetLoaded();
}

function installExternalListeners() {
  window.addEventListener("entity-label:changed", handleBrowserPresetChange);
  removeSocketListener = socketService.on(
    "entity_preset_changed",
    (data: { entityPreset?: EntityPreset }) => {
      setEntityPreset(data?.entityPreset);
    },
  );
}

function removeExternalListeners() {
  window.removeEventListener("entity-label:changed", handleBrowserPresetChange);
  removeSocketListener?.();
  removeSocketListener = null;
}

export function subscribeEntityPreset(listener: () => void): () => void {
  if (subscribers.size === 0) installExternalListeners();
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) removeExternalListeners();
  };
}

export function setEntityPreset(value: unknown): boolean {
  if (!isEntityPreset(value)) return false;
  publish({ preset: value, loading: false });
  return true;
}

export function ensureEntityPresetLoaded(): Promise<void> {
  if (!snapshot.loading || loadPromise) return loadPromise ?? Promise.resolve();

  loadPromise = getModuleSettings()
    .then((settings) => {
      setEntityPreset(settings.entityPreset);
    })
    .catch(() => {
      setEntityPreset(DEFAULT_ENTITY_PRESET);
    })
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}

export function resetEntityPresetStoreForTests(): void {
  removeExternalListeners();
  subscribers.clear();
  loadPromise = null;
  snapshot = initialSnapshot;
}
