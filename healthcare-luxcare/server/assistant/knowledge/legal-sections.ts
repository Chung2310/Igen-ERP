import type { LegalLifecycle } from "./legal-policy";
import { currentLegalDocuments, legalApplies } from "./legal-policy";

export interface LegalSection {
  key: string;
  label: string;
  start: number;
  end: number;
}
export interface LegalSectionChange {
  action: "replace" | "repeal" | "add";
  targetKey: string;
  targetLabel: string;
  sourceKeys: string[];
  previousAmendmentId?: unknown;
}
export interface SectionedLegalDocument extends LegalLifecycle {
  amends?: unknown;
  sections?: LegalSection[];
  sectionChanges?: LegalSectionChange[];
  structureRevision?: string;
}

/** Suggestions only: quotes and annexes can resemble headings; a reviewer confirms every boundary. */
export function suggestLegalSections(text: string): LegalSection[] {
  const boundaries: Array<{ start: number; key: string; label: string }> = [];
  let article = "";
  const used = new Set<string>();
  const headings = /^[ \t]*(?:Điều\s+(\d+[a-zđ]?)\s*[.:]([^\n]*)|(\d+)\.\s+([^\n]*))/gimu;
  for (const match of text.matchAll(headings)) {
    if (match[1]) article = `dieu-${match[1].toLowerCase()}`;
    else if (!article) continue;
    const key = match[1] ? article : `${article}/khoan-${match[3]}`;
    // Ambiguous numbering is left in its enclosing unit for manual splitting.
    if (used.has(key)) continue;
    used.add(key);
    boundaries.push({
      start: match.index!,
      key,
      label: match[1]
        ? `Điều ${match[1]}${match[2].slice(0, 120)}`
        : `Khoản ${match[3]} ${article.replace("dieu-", "Điều ")}`,
    });
    if (boundaries.length >= 499) break;
  }
  if (!boundaries.length) return [{ key: "toan-van", label: "Toàn văn", start: 0, end: text.length }];
  if (boundaries[0].start > 0) {
    if (text.slice(0, boundaries[0].start).trim())
      boundaries.unshift({ key: "mo-dau", label: "Phần mở đầu", start: 0 });
    else boundaries[0].start = 0;
  }
  return boundaries.map((b, index) => ({ ...b, end: boundaries[index + 1]?.start ?? text.length }));
}

export function validateLegalSections(sections: LegalSection[], text: string): void {
  if (!Array.isArray(sections) || !sections.length || sections.length > 500)
    throw new Error("Cần từ 1 đến 500 phần văn bản.");
  let cursor = 0;
  const keys = new Set<string>();
  for (const section of sections) {
    if (!/^[a-z0-9][a-z0-9/_-]{0,99}$/.test(section.key) || keys.has(section.key))
      throw new Error("Mã điều/khoản phải hợp lệ và không trùng.");
    if (!section.label?.trim() || section.label.length > 200) throw new Error("Tên điều/khoản không hợp lệ.");
    if (
      !Number.isInteger(section.start) ||
      !Number.isInteger(section.end) ||
      section.start !== cursor ||
      section.end <= section.start ||
      section.end > text.length
    )
      throw new Error("Các phần phải liên tiếp, không chồng lặp và bao phủ nguyên văn file nguồn.");
    if (!text.slice(section.start, section.end).trim()) throw new Error("Không tách riêng phần chỉ có khoảng trắng.");
    keys.add(section.key);
    cursor = section.end;
  }
  if (cursor !== text.length) throw new Error("Cấu trúc chưa bao phủ hết nội dung file nguồn.");
}

export interface EffectiveLegalUnit<T> {
  document: T;
  root: T;
  sectionKey?: string;
  targetKey?: string;
  targetLabel?: string;
  action?: "replace" | "repeal" | "add";
}

/** Project each provision from its immutable source, never from overlapping legacy chunks. */
export function effectiveLegalUnits<T extends SectionedLegalDocument>(
  documents: T[],
  companyCode: string,
  at = new Date(),
): EffectiveLegalUnit<T>[] {
  const roots = currentLegalDocuments(
    documents.filter((d) => !d.amends),
    companyCode,
    at,
  );
  const units: EffectiveLegalUnit<T>[] = [];
  for (const root of roots) {
    if (!root.structureRevision || !root.sections?.length) {
      units.push({ root, document: root });
      continue;
    }
    const provisions = new Map<string, EffectiveLegalUnit<T>[]>(
      root.sections.map((section) => [
        section.key,
        [{ root, document: root, sectionKey: section.key, targetKey: section.key, targetLabel: section.label }],
      ]),
    );
    const changes = documents
      .filter(
        (d) =>
          d.approvedAt &&
          String(d.amends || "") === String(root._id) &&
          d.effectiveFrom <= at &&
          legalApplies(d, companyCode),
      )
      .sort(
        (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime() || String(a._id).localeCompare(String(b._id)),
      );
    for (const document of changes) {
      for (const change of document.sectionChanges || []) {
        // Withdrawal, expiry or missing new index leaves a gap; it cannot restore old wording.
        provisions.delete(change.targetKey);
        const published =
          document.status === "approved" ||
          (document.status === "withdrawn" && document.withdrawnAt && document.withdrawnAt > at);
        if (!published || (document.effectiveTo && document.effectiveTo <= at) || !document.structureRevision) continue;
        const sourceKeys = new Set(document.sections?.map((s) => s.key));
        if (!change.sourceKeys.every((key) => sourceKeys.has(key))) continue;
        provisions.set(
          change.targetKey,
          change.sourceKeys.map((sectionKey) => ({
            root,
            document,
            sectionKey,
            targetKey: change.targetKey,
            targetLabel: change.targetLabel,
            action: change.action,
          })),
        );
      }
    }
    units.push(...[...provisions.values()].flat());
  }
  return units;
}

export function legalAsOf(value: unknown): Date {
  if (value instanceof Date && Number.isFinite(value.getTime())) return new Date(value);
  if (value === undefined || value === "") return new Date();
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Ngày tra cứu phải có dạng YYYY-MM-DD.");
  const parsed = new Date(`${value}T00:00:00+07:00`);
  if (!Number.isFinite(parsed.getTime()) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)
    throw new Error("Ngày tra cứu không hợp lệ.");
  return parsed;
}
