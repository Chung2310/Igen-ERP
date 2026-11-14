// Profile and system fields already have an owner; they must not become free-form notes.
const CUSTOMER_FIELDS = new Set([
  "name", "phone", "email", "avatarUrl", "dateOfBirth", "gender", "address", "notes",
  "type", "customerKind", "contactName", "status", "source", "normalizedPhone", "phoneIdentityKey",
  "_id", "id", "__v", "companyCode", "companyId", "branchId", "customerId", "customerCode",
  "createdBy", "createdByName", "createdAt", "updatedAt", "updatedBy", "deletedAt", "version",
  "tier", "tierGrossProfit", "tierTotalSales", "tierUpdatedAt",
  "pointsBalance", "totalPointsEarned", "totalPointsRedeemed", "allowSharedPhone",
]);

export function appendCustomerNotes(current: string | undefined, additions: readonly string[]): string {
  let notes = String(current ?? "").replace(/\r\n/g, "\n").trim();
  for (const addition of additions) {
    const text = addition.replace(/\r\n/g, "\n").trim();
    if (!text || `\n${notes}\n`.includes(`\n${text}\n`)) continue;
    notes = notes ? `${notes}\n${text}` : text;
  }
  return notes;
}

export function additionalCustomerNotes(input: Record<string, unknown>): string[] {
  return Object.entries(input).flatMap(([key, value]) => {
    if (!key.trim() || CUSTOMER_FIELDS.has(key) || /^[\s_$]/.test(key)
      || /password|token|secret|authorization|cookie/i.test(key)
      || value === undefined || value === null) return [];
    const text = typeof value === "string" ? value.trim()
      : typeof value === "object" ? JSON.stringify(value) : String(value);
    if (!text || text === "[]" || text === "{}") return [];
    if (key === "additionalNotes" && typeof value === "string") return text.split(/\r?\n/);
    return [`${key}: ${text}`];
  });
}
