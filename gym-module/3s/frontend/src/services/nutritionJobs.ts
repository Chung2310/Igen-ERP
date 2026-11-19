import { getSession as getStoredSession } from './session';
import { api } from './api';
const storage = localStorage;
const get = async <T>(path: string) => (await api.get<T>(path)).data;
const post = async <T>(path: string, body: unknown) => (await api.post<T>(path, body)).data;
interface NutritionJob<T> { id: string; status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED'; result?: T; error?: { message: string } }
export interface NutritionJobInput { customerId: string; request: string; planId?: string; durationDays?: number }
const inFlight = new Map<string, Promise<unknown>>();
export async function generateNutritionJob<T>(input: NutritionJobInput): Promise<T> {
  const session = await getStoredSession();
  if (!session) throw new Error('Vui lòng đăng nhập lại.');
  const storageKey = `nutrition-job:${session.user.id}:${JSON.stringify(input)}`;
  const existing = inFlight.get(storageKey);
  if (existing) return existing as Promise<T>;
  const work = runNutritionJob<T>(input, storageKey).finally(() => inFlight.delete(storageKey));
  inFlight.set(storageKey, work);
  return work;
}
async function runNutritionJob<T>(input: NutritionJobInput, storageKey: string): Promise<T> {
  const saved = await storage.getItem(storageKey);
  const key = saved || `nutrition-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await storage.setItem(storageKey, key);
  // Keep the same key after a lost POST response or failed poll: never start another billed job.
  let job = await post<NutritionJob<T>>('/api/content-drafts/nutrition/jobs', { ...input, idempotencyKey: key });
  const deadline = Date.now() + 30 * 60 * 1000;
  while (job.status === 'PENDING' || job.status === 'PROCESSING') {
    if (Date.now() > deadline) throw new Error('AI vẫn đang xử lý. Thử lại cùng yêu cầu để tiếp tục theo dõi; không tạo lại tác vụ.');
    await new Promise(resolve => setTimeout(resolve, 2500));
    job = await get<NutritionJob<T>>(`/api/content-drafts/nutrition/jobs/${job.id}`);
  }
  if (job.status === 'FAILED') {
    await storage.removeItem(storageKey);
    throw new Error(job.error?.message || 'Không thể tạo thực đơn AI.');
  }
  if (!job.result) throw new Error('Tác vụ chưa có kết quả thực đơn.');
  await storage.removeItem(storageKey);
  return job.result;
}