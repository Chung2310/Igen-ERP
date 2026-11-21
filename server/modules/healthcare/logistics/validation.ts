import Joi from "joi";
import { ValidationError } from "../../../errors/app-error";
const text = (max = 200) => Joi.string().trim().max(max).allow("").default("");
export const id = Joi.string().guid({ version: "uuidv4" }).required();
const ref = Joi.string().trim().max(80).allow("").default("");
const day = Joi.string()
  .allow("")
  .custom((value, helpers) => {
    if (!value) return value;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    )
      return helpers.error("date.base");
    return value;
  })
  .default("");
const url = Joi.string()
  .uri({ scheme: ["https"] })
  .max(2048)
  .allow("")
  .default("");
export const attachmentInput = Joi.object({
  name: text().invalid("").required(),
  type: text(),
  number: text(),
  authority: text(),
  issuedDay: day,
  expiryDay: day,
  notes: text(1000),
});
const documents = Joi.array()
  .max(30)
  .items(
    Joi.object({
      name: text().invalid("").required(),
      url: url.invalid("").required(),
      expiryDay: day,
      type: text(),
      number: text(),
      issuedDay: day,
      authority: text(),
      notes: text(1000),
    }),
  )
  .default([]);
export const equipmentInput = Joi.object({
  imageUrl: url,
  code: Joi.string().trim().max(80).required(),
  name: Joi.string().trim().max(200).required(),
  category: Joi.string().trim().max(200).invalid("").required(),
  status: Joi.string()
    .valid("available", "maintenance", "retired")
    .default("available"),
  departmentId: ref,
  roomId: ref,
  location: text(),
  manufacturer: text(),
  modelNumber: text(),
  serialNumber: text(),
  originCountry: text(),
  riskClassification: Joi.string().valid("", "A", "B", "C", "D").default(""),
  purchaseDay: day,
  usageStartDay: day,
  inspectionCycleMonths: Joi.number().integer().min(0).max(120).default(0),
  nextInspectionDay: day,
  lastInspectionDay: day,
  lastInspectionResult: Joi.string()
    .valid("", "pass", "fail", "conditional")
    .default(""),
  lastInspectionProvider: text(),
  lastInspectionReportUrl: url,
  notes: text(4000),
  documents,
});
export const supplyInput = Joi.object({
  code: Joi.string().trim().max(80).required(),
  name: Joi.string().trim().max(200).required(),
  category: text(),
  unit: Joi.string().trim().max(40).required(),
  minQuantity: Joi.number().min(0).max(1e9).precision(3).default(0),
  requiresExpiry: Joi.boolean().default(true),
  active: Joi.boolean().default(true),
  supplierId: ref,
  warehouseId: ref,
  roomId: ref,
  warehouseLocation: text(),
  manufactureDay: day,
  batchNumber: text(100),
  expiryDay: day,
  inspectionDay: day,
  nextInspectionDay: day,
  inspectionCertificateNumber: text(),
  imageUrl: url,
  unitPrice: Joi.number().min(0).max(1e12).default(0),
  notes: text(4000),
  documents,
});
export const stockInput = Joi.object({
  type: Joi.string().valid("opening", "receipt", "issue").required(),
  voucherCode: text(80),
  voucherDay: day,
  warehouseId: ref.required().invalid(""),
  supplierId: ref,
  departmentId: ref,
  reason: Joi.string().trim().min(1).max(1000).required(),
  lines: Joi.array()
    .min(1)
    .max(100)
    .items(
      Joi.object({
        supplyId: id,
        quantity: Joi.number().positive().max(1e9).precision(6).required(),
        unit: text(40),
        lot: text(100),
        expiryDay: day,
        quality: Joi.string()
          .valid("available", "quarantine", "damaged")
          .default("available"),
        value: Joi.number().integer().min(0).max(1e12).default(0),
      }),
    )
    .required(),
});
export const inspectionInput = Joi.object({
  day: day.required().invalid(""),
  nextDay: day,
  kind: Joi.string()
    .valid("inspection", "calibration", "maintenance")
    .required(),
  result: Joi.string().valid("pass", "fail", "conditional").required(),
  provider: text(),
  notes: text(4000),
  reportUrl: url,
});
export const requestInput = Joi.object({
  type: Joi.string().valid("borrow", "return").required(),
  reason: Joi.string().trim().min(1).max(1000).required(),
  expectedReturnDay: day,
});
export const revisionInput = Joi.number().integer().min(1).required();
export const actionInput = Joi.object({
  revision: revisionInput,
  action: Joi.string()
    .valid("approve", "reject", "cancel", "submit", "post")
    .required(),
  reason: text(1000),
});
export function input<T>(schema: Joi.Schema, value: unknown): T {
  const result = schema.validate(value, { abortEarly: false, convert: true });
  if (result.error)
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường.",
      {
        fields: result.error.details.map((d) => d.path.join(".")),
      },
    );
  return result.value as T;
}
