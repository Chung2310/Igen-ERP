import { getModuleSettings } from "../api/moduleSettings.api";
import {
  DEFAULT_ENTITY_PRESET,
  ENTITY_PRESETS,
  type EntityPreset,
} from "../config/entityLabels";
import { socketService } from "../../../services/socketService";
import { withRequestTimeout } from "../../../utils/requestTimeout";

export type EntityPresetSnapshot = {
  preset: EntityPreset;
  loading: boolean;
  error?: string;
};

const initialSnapshot: EntityPresetSnapshot = {
  preset: DEFAULT_ENTITY_PRESET,
  loading: true,
};

/** Chờ giữa hai lần thử lại để một API lỗi không bị gọi dồn. */
const RETRY_COOLDOWN_MS = 5000;
const MAX_LOAD_ATTEMPTS = 3;

let snapshot = initialSnapshot;
let loadPromise: Promise<void> | null = null;
let lastFailureAt = 0;
let failedAttempts = 0;
let requestVersion = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let removeSocketListener: (() => void) | null = null;
let scope: { userId: string; companyCode: string } | null | undefined;
let scopeKey = '';
let controller: AbortController | null = null;
const subscribers = new Set<() => void>();

function publish(nextSnapshot: EntityPresetSnapshot) {
  snapshot = nextSnapshot;
  subscribers.forEach((listener) => listener());
}

function clearRetry() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function scheduleRetry() {
  if (!subscribers.size || !snapshot.loading || !lastFailureAt || failedAttempts >= MAX_LOAD_ATTEMPTS || retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void ensureEntityPresetLoaded();
  }, Math.max(0, RETRY_COOLDOWN_MS - (Date.now() - lastFailureAt)));
}

function retryWhenOnline() {
  if (snapshot.loading) void retryEntityPresetLoad();
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

  void retryEntityPresetLoad();
}

function installExternalListeners() {
  const subscribedScope = scopeKey;
  window.addEventListener("entity-label:changed", handleBrowserPresetChange);
  window.addEventListener("online", retryWhenOnline);
  removeSocketListener = socketService.on(
    "entity_preset_changed",
    (data: { entityPreset?: EntityPreset }) => {
      if (scopeKey !== subscribedScope) return;
      setEntityPreset(data?.entityPreset);
    },
  );
}

/** Reset tenant metadata without dropping mounted consumers. */
export function setEntityPresetScope(next: { userId: string; companyCode: string } | null) {
  const key = next ? JSON.stringify([next.userId, next.companyCode.trim().toUpperCase()]) : 'signed-out';
  if (scopeKey === key) return;
  removeExternalListeners();
  controller?.abort(); controller = null;
  scope = next; scopeKey = key;
  requestVersion++;
  loadPromise = null; lastFailureAt = 0; failedAttempts = 0;
  publish(initialSnapshot);
  if (subscribers.size) installExternalListeners();
}

function removeExternalListeners() {
  window.removeEventListener("entity-label:changed", handleBrowserPresetChange);
  window.removeEventListener("online", retryWhenOnline);
  clearRetry();
  removeSocketListener?.();
  removeSocketListener = null;
}

export function subscribeEntityPreset(listener: () => void): () => void {
  if (subscribers.size === 0) installExternalListeners();
  subscribers.add(listener);
  scheduleRetry();
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) removeExternalListeners();
  };
}

export function setEntityPreset(value: unknown): boolean {
  if (!isEntityPreset(value)) return false;
  requestVersion++;
  loadPromise = null;
  lastFailureAt = 0;
  failedAttempts = 0;
  clearRetry();
  publish({ preset: value, loading: false });
  return true;
}

/**
 * Không chốt loại hình mặc định khi gọi API lỗi: một lần lỗi tạm thời (401 lúc
 * mới khởi động, mất mạng, module chưa bật xong) từng khiến toàn hệ thống đứng
 * ở "Học viên" vĩnh viễn dù công ty đang là "Lao động", trong khi trang Cài đặt
 * tự gọi lại API nên vẫn hiện đúng. Giữ loại hình chờ dữ liệu thật, nhưng tự
 * thử lại có giới hạn và cho phép thử lại ngay trên màn hình khi có lỗi.
 */
export function ensureEntityPresetLoaded(): Promise<void> {
  if (scope === null) return Promise.resolve();
  if (!snapshot.loading) return Promise.resolve();
  if (loadPromise) return loadPromise;
  if (failedAttempts >= MAX_LOAD_ATTEMPTS) return Promise.resolve();
  if (lastFailureAt > 0 && Date.now() - lastFailureAt < RETRY_COOLDOWN_MS) return Promise.resolve();

  clearRetry();
  const version = ++requestVersion;
  controller = new AbortController();
  const companyCode = scope?.companyCode.trim().toUpperCase();
  loadPromise = withRequestTimeout(
    (signal) => getModuleSettings(undefined, { signal }),
    15000,
    'Tải cấu hình học viên quá lâu. Vui lòng thử lại.',
    controller.signal,
  )
    .then((settings) => {
      if (version !== requestVersion) return;
      if (companyCode && settings?.tenantId?.trim().toUpperCase() !== companyCode) throw new Error('Cấu hình doanh nghiệp không khớp.');
      if (!setEntityPreset(settings?.entityPreset)) throw new Error('Cấu hình học viên trả về không hợp lệ.');
    })
    .catch(() => {
      if (version !== requestVersion) return;
      lastFailureAt = Date.now();
      failedAttempts++;
      publish({ ...snapshot, loading: true, error: 'Không thể tải cấu hình học viên. Bạn có thể thử lại mà không cần tải lại web.' });
    })
    .finally(() => {
      if (version !== requestVersion) return;
      loadPromise = null;
      scheduleRetry();
    });

  return loadPromise;
}

export function retryEntityPresetLoad(): Promise<void> {
  if (loadPromise) return loadPromise;
  clearRetry();
  lastFailureAt = 0;
  failedAttempts = 0;
  publish({ preset: snapshot.preset, loading: true });
  return ensureEntityPresetLoaded();
}

export function resetEntityPresetStoreForTests(): void {
  removeExternalListeners();
  subscribers.clear();
  loadPromise = null;
  lastFailureAt = 0;
  failedAttempts = 0;
  requestVersion++;
  snapshot = initialSnapshot;
  controller?.abort(); controller = null;
  scope = undefined; scopeKey = '';
}
