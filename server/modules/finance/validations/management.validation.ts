import Joi from "joi";
import { ValidationError } from "../../../errors/app-error";
const money = Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER);
const day = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((v, helpers) => { const d = new Date(v); return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? helpers.error("any.invalid") : v; });
const text = Joi.string().trim().max(500).allow("");
export const managementSchemas = {
    reversal: Joi.object({ reason: Joi.string().trim().min(1).max(500).required(), date: day.required(), idempotencyKey: Joi.string().min(8).max(100).required() }),
    voucher: Joi.object({ kind: Joi.string().valid("receipt", "payment").required(), category: Joi.string().valid("rent", "salary", "marketing", "utilities", "repair", "other_expense", "supplier", "capital", "other_receipt").required(), expenseClass: Joi.string().valid("fixed", "variable", "none").required(), amount: money.min(1).required(), date: day.required(), counterparty: text, method: Joi.string().valid("cash", "transfer", "card", "other").required(), note: text, attachment: Joi.string().max(2000).uri({ scheme: ["https"] }).allow(""), payableId: Joi.string().hex().length(24), idempotencyKey: Joi.string().min(8).max(100).required() }),
    payable: Joi.object({ receiptId: Joi.string().hex().length(24).required(), dueDate: day.required(), openingPaid: money.required(), note: text }),
    followup: Joi.object({ targetType: Joi.string().valid("receivable", "payable").required(), targetId: Joi.string().hex().length(24).required(), status: Joi.string().valid("new", "contacted", "promised", "partial", "done").required(), promiseDate: day, promiseAmount: money, assignee: text, note: text }),
    tax: Joi.object({ direction: Joi.string().valid("input", "output").required(), invoiceNumber: Joi.string().trim().max(100).required(), taxId: Joi.string().trim().max(30).required(), counterparty: text, date: day.required(), base: money.required(), rate: Joi.number().min(0).max(100).required(), vat: money.required(), deductible: Joi.boolean().required(), sourceOrderId: Joi.string().hex().length(24), note: text }),
    settings: Joi.object({ period: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).required(), fixedCostBudget: money.required(), vatCarryforward: money.required(), note: text }),
    range: Joi.object({ from: day.required(), to: day.required() }),
};
export function validateManagement(kind: keyof typeof managementSchemas, input: unknown): any {
    const { value, error } = managementSchemas[kind].validate(input, { abortEarly: false, convert: false });
    if (error)
        throw new ValidationError("VALIDATION_FAILED", "Dữ liệu tài chính không hợp lệ. Kiểm tra ngày, số tiền và các trường bắt buộc.");
    if (kind === "tax" && value.vat !== Math.round(value.base * value.rate / 100))
        throw new ValidationError("VALIDATION_FAILED", "Tiền VAT phải bằng tiền trước thuế × thuế suất, làm tròn đến đồng.");
    return value;
}
