import crypto from "node:crypto";
import { effectiveLegalUnits, type SectionedLegalDocument } from "./legal-sections";
import { legalApplies } from "./legal-policy";

export function knowledgeReviewRevision(document: {
  activeRevision?: string | null;
  version?: number;
  contentHash?: string;
}) {
  return document.activeRevision || `legacy:${document.version || 0}:${document.contentHash || ""}`;
}
export function hasLegalNumber(text: string, number: string) {
  const normalize = (value: string) =>
    value
      .normalize("NFC")
      .toUpperCase()
      .replace(/[–—]/g, "-")
      .replace(/\s*([/-])\s*/g, "$1")
      .replace(/\s+/g, " ");
  const target = normalize(number).trim();
  // Bare serials/year-like numbers are too ambiguous for automatic suggestions.
  if (target.length < 8 || !/\d/.test(target)) return false;
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "u").test(normalize(text));
}
export function expandedReviewChunks(indexes: number[], all: number[]) {
  const selected = new Set(indexes.flatMap((index) => [index - 1, index, index + 1]));
  return all.filter((index) => selected.has(index));
}
type DependencyLaw = SectionedLegalDocument & { approvedRevision?: string; number: string };
export function legalDependencySnapshot(
  lawId: unknown,
  sectionKeys: string[],
  laws: DependencyLaw[],
  companyCode: string,
  at = new Date(),
) {
  const law = laws.find((item) => String(item._id) === String(lawId));
  if (!law || !law.approvedAt || !legalApplies(law, companyCode))
    return {
      fingerprint: "unavailable",
      available: false,
      number: "không còn trong phạm vi",
      sectionKeys: [] as string[],
    };
  const rootId = law.amends || law._id;
  const watched = sectionKeys.length
    ? sectionKeys
    : law.amends
      ? law.sectionChanges?.map((change) => change.targetKey) || []
      : [];
  const units = effectiveLegalUnits(laws, companyCode, at).filter(
    (unit) =>
      String(unit.root._id) === String(rootId) &&
      (!watched.length || Boolean(unit.targetKey && watched.includes(unit.targetKey))),
  );
  const values = units
    .map((unit) => [
      String(unit.document._id),
      unit.document.structureRevision || unit.document.approvedRevision || "",
      unit.sectionKey || "",
      unit.targetKey || "",
      unit.action || "original",
    ])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify({ law: String(lawId), watched: [...watched].sort(), values }))
    .digest("hex");
  const root = laws.find((item) => String(item._id) === String(rootId));
  return {
    fingerprint,
    available: units.length > 0,
    number: law.number,
    sectionKeys: [
      ...new Set([
        ...(root?.sections?.map((section) => section.key) || []),
        ...laws
          .filter((d) => String(d.amends || "") === String(rootId))
          .flatMap((d) => d.sectionChanges?.map((c) => c.targetKey) || []),
      ]),
    ],
  };
}
export interface ReviewBinding {
  state: string;
  relation?: string | null;
  scope?: string;
  chunkIndexes?: number[];
  sectionKeys?: string[];
  reviewedRevision?: string | null;
  reviewedLegalFingerprint?: string | null;
}
export function knowledgeReviewStatus(
  link: ReviewBinding,
  revision: string,
  snapshot: { fingerprint: string; available: boolean },
) {
  if (link.state !== "confirmed") return link.state;
  if (link.reviewedRevision !== revision) return "document_changed";
  if (link.relation === "copy") return "using_shared";
  if (!snapshot.available || link.reviewedLegalFingerprint !== snapshot.fingerprint) return "needs_review";
  return "current";
}
