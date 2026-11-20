// Reserved storage namespace; never exposed through tenant knowledge APIs.
export const LEGAL_COMPANY = "__LEGAL_SHARED__";

export function canManageLegal(user?: { role?: string }) {
  return ["superadmin", "blog_editor", "blog_author"].includes(String(user?.role || "").toLowerCase());
}
export function canApproveLegal(user?: { role?: string }) {
  return ["superadmin", "blog_editor"].includes(String(user?.role || "").toLowerCase());
}
export interface LegalLifecycle {
  _id: unknown;
  status: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  companyCodes: string[];
  replaces?: unknown;
  approvedAt?: Date | null;
  withdrawnAt?: Date | null;
  isDeleted?: boolean;
}
export function legalApplies(document: Pick<LegalLifecycle, "companyCodes">, companyCode: string) {
  return (
    Boolean(companyCode && companyCode !== LEGAL_COMPANY) &&
    (!document.companyCodes.length || document.companyCodes.includes(companyCode.toUpperCase()))
  );
}
export function currentLegalDocuments<T extends LegalLifecycle>(
  documents: T[],
  companyCode: string,
  now = new Date(),
): T[] {
  // A withdrawn/expired successor must never silently resurrect its predecessor.
  const superseded = new Set(
    documents.filter((d) => d.approvedAt && d.replaces && d.effectiveFrom <= now).map((d) => String(d.replaces)),
  );
  return documents.filter(
    (d) =>
      !d.isDeleted &&
      (d.status === "approved" ||
        (d.status === "withdrawn" && Boolean(d.approvedAt && d.withdrawnAt && d.withdrawnAt > now))) &&
      d.effectiveFrom <= now &&
      (!d.effectiveTo || d.effectiveTo > now) &&
      !superseded.has(String(d._id)) &&
      legalApplies(d, companyCode),
  );
}
