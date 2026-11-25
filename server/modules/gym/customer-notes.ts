import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import Joi from "joi";
import { ConflictError, ValidationError } from "../../errors/app-error";
import type { GymActor } from "./access";
import { tenantFilter } from "./access";
import { lockCustomer, publicRecord, records } from "./store";
const schema = Joi.object({
  consultationDate: Joi.string().isoDate().required(),
  currentCondition: Joi.string().trim().max(4000).required(),
  advice: Joi.string().trim().max(4000).required(),
  actionPlan: Joi.string().trim().max(4000).allow("").default(""),
  notes: Joi.string().trim().max(2000).allow("").default(""),
});
export async function saveConsultation(
  actor: GymActor,
  customerId: string,
  input: unknown,
  revision: number,
  noteId?: string,
  remove = false,
) {
  const result = remove
    ? { value: undefined, error: undefined }
    : schema.validate(input);
  if (result.error)
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Vui lòng nhập thể trạng và lời khuyên tư vấn.",
    );
  return mongoose.connection.transaction(async (session) => {
    const customer = await lockCustomer(actor, customerId, session);
    if (customer.revision !== revision)
      throw new ConflictError(
        "CONFLICT",
        "Hồ sơ đã thay đổi. Vui lòng tải lại.",
      );
    const notes = customer.consultations || [];
    if (noteId && !notes.some((n: any) => n._id === noteId))
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Không tìm thấy buổi tư vấn.",
      );
    if (!noteId && notes.length >= 200)
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Hồ sơ đã đạt giới hạn 200 buổi tư vấn.",
      );
    const entry = {
      ...result.value,
      _id: noteId || new ObjectId().toHexString(),
      createdBy: actor.userId,
    };
    const consultations = remove
      ? notes.filter((n: any) => n._id !== noteId)
      : noteId
        ? notes.map((n: any) => (n._id === noteId ? entry : n))
        : [...notes, entry];
    const updated = await records("customers").findOneAndUpdate(
      { ...tenantFilter(actor), _id: customerId, revision },
      {
        $set: { consultations, updatedAt: new Date().toISOString() },
        $inc: { revision: 1 },
      },
      { session, returnDocument: "after" },
    );
    return publicRecord(updated!);
  });
}
