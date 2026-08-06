import { apiFetch } from "../lib/api";

export type BatchProgressColors = { green: string; yellow: string; red: string; black: string };

export const DEFAULT_BATCH_PROGRESS_COLORS: BatchProgressColors = {
  green: "#059669", yellow: "#d97706", red: "#e11d48", black: "#020617",
};

export async function getBatchProgressColors(): Promise<BatchProgressColors> {
  const response = await apiFetch<{ success: boolean; data: BatchProgressColors }>("/batches/settings/progress-colors");
  return response.data;
}

export async function updateBatchProgressColors(colors: BatchProgressColors): Promise<BatchProgressColors> {
  const response = await apiFetch<{ success: boolean; data: BatchProgressColors }>("/batches/settings/progress-colors", { method: "PATCH", body: JSON.stringify(colors) });
  return response.data;
}
