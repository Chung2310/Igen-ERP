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

/** Chờ giữa hai lần thử lại để một API lỗi không bị gọi dồn. */
const RETRY_COOLDOWN_MS = 5000;

let snapshot = initialSnapshot;
let loadPromise: Promise<void> | null = null;
let lastFailureAt = 0;
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

/**
 * Không chốt loại hình mặc định khi gọi API lỗi: một lần lỗi tạm thời (401 lúc
 * mới khởi động, mất mạng, module chưa bật xong) từng khiến toàn hệ thống đứng
 * ở "Học viên" vĩnh viễn dù công ty đang là "Lao động", trong khi trang Cài đặt
 * tự gọi lại API nên vẫn hiện đúng. Nay giữ trạng thái loading để lần mount sau
 * thử lại, và loại hình chỉ được đặt từ dữ liệu thật của server.
 */
export function ensureEntityPresetLoaded(): Promise<void> {
  if (!snapshot.loading) return Promise.resolve();
  if (loadPromise) return loadPromise;
  if (lastFailureAt > 0 && Date.now() - lastFailureAt < RETRY_COOLDOWN_MS) return Promise.resolve();

  loadPromise = getModuleSettings()
    .then((settings) => {
      lastFailureAt = setEntityPreset(settings.entityPreset) ? 0 : Date.now();
    })
    .catch(() => {
      lastFailureAt = Date.now();
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
  lastFailureAt = 0;
  snapshot = initialSnapshot;
}
