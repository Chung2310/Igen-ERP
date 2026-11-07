import type { Worker } from "../../modules/worker-management/types";

export function workerDistributions(workers: Worker[]) {
  const types = { official: 0, seasonal: 0, foreign: 0, unknown: 0 };
  const partners = new Map<string, number>();
  for (const worker of workers) {
    types[worker.laborType || "unknown"]++;
    const partner = worker.partnerName?.trim();
    if (partner) partners.set(partner, (partners.get(partner) || 0) + 1);
  }
  const top = (values: Map<string, number>) => [...values].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  return { types, partners: top(partners) };
}
