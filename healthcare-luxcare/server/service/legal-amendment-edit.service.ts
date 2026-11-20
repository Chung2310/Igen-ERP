import Joi from "joi";
import { LegalDocumentModel } from "../model/legal-document.model";
import { legalMetadataSchema } from "../validation/legal-document.validation";
import { canManageLegal } from "../assistant/knowledge/legal-policy";

const schema = Joi.object({
  updatedAt: Joi.string().isoDate().required(),
  amends: Joi.string().hex().length(24).allow("").required(),
  sectionChanges: legalMetadataSchema.extract("sectionChanges"),
}).unknown(false);
export async function editLegalAmendment(user: { id: string; role: string }, id: string, body: unknown) {
  if (!canManageLegal(user)) throw new Error("Bạn không có quyền đối chiếu pháp lý.");
  const result = schema.validate(body);
  if (result.error) throw new Error(result.error.message);
  const input = result.value;
  if (!input.amends && input.sectionChanges.length) throw new Error("Chọn văn bản gốc để đối chiếu.");
  const document = await LegalDocumentModel.findOneAndUpdate(
    {
      _id: id,
      status: "draft",
      updatedAt: new Date(input.updatedAt),
      ...(user.role === "blog_author" ? { createdBy: user.id } : {}),
    },
    {
      $set: { sectionChanges: input.sectionChanges, ...(input.amends ? { amends: input.amends } : {}) },
      $unset: { ...(input.amends ? { replaces: 1 } : { amends: 1 }) },
    },
    { returnDocument: "after" },
  );
  if (!document) throw new Error("Bản chờ duyệt đã thay đổi hoặc bạn không được phép sửa. Vui lòng tải lại.");
  return document;
}
