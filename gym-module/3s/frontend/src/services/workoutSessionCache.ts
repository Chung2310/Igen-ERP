import type { BodyMeasurementDraft, TrackingResult, WorkoutProgressPhotoDraft } from '../types';

export interface CachedWorkoutSession {
  customerId: string;
  planId: string;
  planVersion: number;
  idempotencyKey: string;
  sessionIndex: number;
  recordedAt: { recordedDate: string; recordedTime: string };
  feeling: string;
  notes: string;
  measurement: BodyMeasurementDraft;
  progressPhotos: Array<Pick<WorkoutProgressPhotoDraft, 'id' | 'file' | 'angle'>>;
  editedResults: Record<number, Array<{ result: TrackingResult; notes?: string }>>;
  signerName: string;
  signatureDataUrl: string;
  updatedAt: string;
}

const databaseName = '3s-gym-progress-cache';
const storeName = 'workout-sessions';
let databasePromise: Promise<IDBDatabase> | null = null;
const pending = new Map<string, Promise<void>>();

export function workoutSessionCacheKey(ownerId: string, customerId: string) {
  return `workout-session:${ownerId}:${customerId}`;
}

function database(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không mở được bộ nhớ trình duyệt.'));
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise!;
}

async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, resolve: (value: T) => void) => void,
): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('Không lưu được cache tiến độ.'));
    tx.onabort = () => reject(tx.error || new Error('Không lưu được cache tiến độ.'));
    action(tx.objectStore(storeName), (value) => { result = value; });
  });
}

function enqueue(key: string, operation: () => Promise<void>): Promise<void> {
  const next = (pending.get(key) || Promise.resolve()).catch(() => {}).then(operation);
  pending.set(key, next);
  void next.finally(() => { if (pending.get(key) === next) pending.delete(key); }).catch(() => {});
  return next;
}

export async function readWorkoutSessionCache(key: string): Promise<CachedWorkoutSession | null> {
  await pending.get(key)?.catch(() => {});
  return transaction<CachedWorkoutSession | null>('readonly', (store, resolve) => {
    const request = store.get(key);
    request.onsuccess = () => resolve((request.result as CachedWorkoutSession | undefined) || null);
  });
}

export function writeWorkoutSessionCache(key: string, value: CachedWorkoutSession): Promise<void> {
  return enqueue(key, () => transaction<void>('readwrite', (store, resolve) => {
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
  }));
}

export function clearWorkoutSessionCache(key: string): Promise<void> {
  return enqueue(key, () => transaction<void>('readwrite', (store, resolve) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
  }));
}