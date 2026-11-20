import { LegalDocumentModel } from "../model/legal-document.model";
import type { LegalSectionChange, SectionedLegalDocument } from "../assistant/knowledge/legal-sections";

/** Returns immutable per-provision claims; their unique multikey index arbitrates concurrent approvals. */
export async function validateLegalAmendment(document: SectionedLegalDocument): Promise<string[]> {
  if (!document.amends) return [];
  if (!document.structureRevision || !document.sections?.length || !document.sectionChanges?.length)
    throw new Error("Văn bản sửa đổi cần cấu trúc đã kiểm tra và ít nhất một đối chiếu điều/khoản.");
  const root = await LegalDocumentModel.findById(document.amends).lean();
  if (!root?.approvedAt || root.amends || !root.structureRevision || !root.sections.length)
    throw new Error("Chọn văn bản gốc đã duyệt và đã kiểm tra cấu trúc điều/khoản.");
  if (root.effectiveFrom >= document.effectiveFrom || (root.effectiveTo && root.effectiveTo <= document.effectiveFrom))
    throw new Error("Ngày sửa đổi phải sau ngày hiệu lực và trước ngày hết hiệu lực của văn bản gốc.");
  if ([...root.companyCodes].sort().join() !== [...document.companyCodes].sort().join())
    throw new Error("Văn bản sửa đổi cần cùng phạm vi doanh nghiệp với văn bản gốc.");
  const keys = new Set(document.sections.map((s) => s.key));
  const targetKeys = new Set<string>();
  const claims: string[] = [];
  for (const change of document.sectionChanges) {
    if (
      targetKeys.has(change.targetKey) ||
      !change.sourceKeys.length ||
      !change.sourceKeys.every((key) => keys.has(key))
    )
      throw new Error("Đối chiếu điều/khoản bị trùng hoặc tham chiếu phần nguồn không tồn tại.");
    targetKeys.add(change.targetKey);
    const rootSection = root.sections.find((s) => s.key === change.targetKey);
    if (change.previousAmendmentId) {
      const prior = await LegalDocumentModel.findById(change.previousAmendmentId).lean();
      const previous = prior?.sectionChanges?.find((item: LegalSectionChange) => item.targetKey === change.targetKey);
      if (
        !prior?.approvedAt ||
        String(prior.amends) !== String(root._id) ||
        !previous ||
        prior.effectiveFrom >= document.effectiveFrom
      )
        throw new Error("Phiên bản điều/khoản trước đó không hợp lệ hoặc có ngày hiệu lực không sớm hơn.");
      if (change.action === "add") throw new Error("Điều/khoản đã có phiên bản trước; chọn sửa đổi hoặc bãi bỏ.");
    } else if ((change.action === "add" && rootSection) || (change.action !== "add" && !rootSection)) {
      throw new Error("Chọn điều/khoản có trong văn bản gốc hoặc khai báo bổ sung điều/khoản mới.");
    }
    claims.push(`${root._id}:${change.targetKey}:${change.previousAmendmentId || "original"}`);
  }
  return claims;
}
