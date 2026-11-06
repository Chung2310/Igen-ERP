import type { ExtendedLeadCard } from "../../modules/marketing-suite/message/services/crmService";

export type LeadStage = ExtendedLeadCard["status"];
const stages: LeadStage[] = ["cold", "warm", "hot", "won", "upsell"];

export function summarizeLeads(leads: ExtendedLeadCard[]) {
  const byStage = Object.fromEntries(stages.map(stage => [stage, 0])) as Record<LeadStage, number>;
  const valueByStage = Object.fromEntries(stages.map(stage => [stage, 0])) as Record<LeadStage, number>;
  for (const lead of leads) {
    if (!stages.includes(lead.status)) continue;
    byStage[lead.status]++;
    const value = Number(lead.value);
    if (Number.isFinite(value) && value > 0) valueByStage[lead.status] += value;
  }
  return { total: leads.length, open: leads.length - byStage.won,
    totalValue: Object.values(valueByStage).reduce((sum, value) => sum + value, 0),
    openValue: Object.entries(valueByStage).filter(([stage]) => stage !== "won").reduce((sum, [, value]) => sum + value, 0),
    byStage, valueByStage };
}

export function leadInsights(leads: ExtendedLeadCard[], now = new Date()) {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dated = leads.flatMap(lead => {
    const date = new Date(lead.createdAt || "");
    return Number.isFinite(date.getTime()) ? [{ lead, date }] : [];
  });
  const newLast30Days = dated.filter(({ date }) => date >= thirtyDaysAgo && date <= now).length;
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, name: `${date.getMonth() + 1}/${date.getFullYear()}`, count: 0 };
  });
  for (const { date } of dated) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = monthly.find(item => item.key === key);
    if (bucket) bucket.count++;
  }
  const productCounts = new Map<string, number>();
  for (const lead of leads) {
    const product = lead.productOfChoice?.trim();
    if (product) productCounts.set(product, (productCounts.get(product) || 0) + 1);
  }
  const products = [...productCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  const won = leads.filter(lead => lead.status === "won").length;
  return { newLast30Days: dated.length ? newLast30Days : null, monthly: dated.length ? monthly : [], products,
    winRate: leads.length ? won / leads.length * 100 : null,
    averageWonValue: won ? leads.filter(lead => lead.status === "won").reduce((sum, lead) => sum + (Number.isFinite(Number(lead.value)) ? Math.max(0, Number(lead.value)) : 0), 0) / won : null };
}
