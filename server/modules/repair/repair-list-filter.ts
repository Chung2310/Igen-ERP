const REPAIR_STATUSES = new Set(["received", "diagnosing", "quoted", "approved", "repairing", "waiting_parts", "waiting_supplier", "done", "delivered", "cancelled", "returned"]);

function validDay(value: unknown): string | undefined {
  const day = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day : undefined;
}

export function buildRepairTicketListFilter(query: Record<string, unknown>): Record<string, unknown> {
  const filter: Record<string, any> = {};
  const status = String(query.status || "").trim();
  if (REPAIR_STATUSES.has(status)) filter.status = status;
  const paymentStatus = String(query.paymentStatus || "").trim();
  if (["unpaid", "partial", "paid"].includes(paymentStatus)) filter.paymentStatus = paymentStatus;
  for (const key of ["customerId", "technicianId"]) {
    const value = String(query[key] || "").trim();
    if (value && value.length <= 100) filter[key] = value;
  }

  const term = String(query.q || "").trim().slice(0, 100);
  if (term) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { ticketCode: { $regex: escaped, $options: "i" } },
      { customerName: { $regex: escaped, $options: "i" } },
      { "device.serialNumber": { $regex: escaped, $options: "i" } },
    ];
  }

  const from = validDay(query.from);
  const to = validDay(query.to);
  if ((!from || !to || from <= to) && (from || to)) {
    const receivedAt: Record<string, Date> = {};
    if (from) receivedAt.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) {
      const endExclusive = new Date(`${to}T00:00:00.000Z`);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      receivedAt.$lt = endExclusive;
    }
    filter.receivedAt = receivedAt;
  }
  return filter;
}
