const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Convert assistant date ranges into overlap filters for interval-based CRUD records. */
export function applyAssistantCrudDateFilters(modelName: string, filters: Record<string, unknown>) {
  if (!["hr-calendar-events", "hr-leave-applications"].includes(modelName)) return filters;
  const next = { ...filters };
  const from = next.rangeStart;
  const to = next.rangeEnd;
  delete next.rangeStart;
  delete next.rangeEnd;
  const validFrom = isValidDateOnly(from) ? from : "";
  const validTo = isValidDateOnly(to) ? to : "";
  if (validFrom && validTo && validFrom > validTo) return next;

  // Calendar events store instants; "today" is a Vietnam calendar day. Leave
  // applications retain their existing UTC date-only storage convention.
  const zone = modelName === "hr-calendar-events" ? "+07:00" : "Z";
  const rangeStart = validFrom ? new Date(`${validFrom}T00:00:00.000${zone}`) : undefined;
  const rangeEnd = validTo ? new Date(`${validTo}T23:59:59.999${zone}`) : undefined;
  if (rangeStart) next.endDate = { $gte: rangeStart };
  if (rangeEnd) next.startDate = { $lte: rangeEnd };
  return next;
}
