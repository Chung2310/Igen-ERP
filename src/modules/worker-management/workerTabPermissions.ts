import { canReadWorkerArea } from "./workerPermissionPolicy";

export const WORKER_TAB_SLUGS = [
  "tong-quan",
  "du-an",
  "lao-dong",
  "thong-bao",
] as const;

export function getAllowedWorkerTabSlugs(permissions: readonly string[]) {
  return canReadWorkerArea(permissions, "worker-profile")
    ? [...WORKER_TAB_SLUGS]
    : [];
}
