/** Legacy stock safeguards shared by the API and inventory forms. */
export type SupplyStockStatus = "in-stock" | "low-stock" | "out-of-stock" | "expired" | "quarantined";
export type SupplyExpiryValue = Date | string | null | undefined;

export function supplyBusinessDay(now = new Date(), timeZone = "Asia/Ho_Chi_Minh"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// Date-only expiry values are persisted as UTC midnight; they are calendar dates, not instants.
export function supplyExpiryDay(value: SupplyExpiryValue): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
}

export function supplyExpiryState(value: SupplyExpiryValue, requiresExpiry = true, now = new Date()) {
  const day = supplyExpiryDay(value);
  if (!day) return requiresExpiry ? "unknown" : "not-applicable";
  return day < supplyBusinessDay(now) ? "expired" : "valid";
}

export function supplyStockStatus(
  quantity: number,
  minQuantity: number,
  expiryDate: SupplyExpiryValue,
  requiresExpiry = true,
  now = new Date(),
): SupplyStockStatus {
  const expiry = supplyExpiryState(expiryDate, requiresExpiry, now);
  if (expiry === "unknown") return "quarantined";
  if (expiry === "expired") return "expired";
  if (quantity <= 0) return "out-of-stock";
  return quantity <= minQuantity ? "low-stock" : "in-stock";
}

export function canIssueSupply(
  supply: {
    quantity: number;
    availableQuantity?: number;
    expiryDate?: SupplyExpiryValue;
    requiresExpiry?: boolean;
    isActive?: boolean;
  },
  now = new Date(),
) {
  if (supply.availableQuantity !== undefined) return supply.isActive !== false && supply.availableQuantity > 0;
  const expiry = supplyExpiryState(supply.expiryDate, supply.requiresExpiry !== false, now);
  return supply.isActive !== false && supply.quantity > 0 && (expiry === "valid" || expiry === "not-applicable");
}
