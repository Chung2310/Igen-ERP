/** Include the full collaborator population, retaining historical ledger parties too. */
export function retailPartnerPerformanceRows(items: Array<{ _id: unknown; commission: number; sources: number }>, partners: Array<{ _id: unknown; name?: string; code?: string }>) {
  const totals = new Map(items.map(item => [String(item._id), item]));
  const names = new Map(partners.map(partner => [String(partner._id), partner]));
  return [...new Set([...names.keys(), ...totals.keys()])].map(id => ({
    partnerName: names.get(id)?.name || "Đối tác đã ngừng hoạt động",
    partnerCode: names.get(id)?.code || "",
    commission: totals.get(id)?.commission ?? 0,
    sources: totals.get(id)?.sources ?? 0,
  })).sort((a, b) => b.commission - a.commission || a.partnerName.localeCompare(b.partnerName, "vi"));
}
