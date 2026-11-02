import type { RetailBranchScope } from "../contracts";
import { RetailBirthdayProgramModel } from "../models/retail-birthday-program.model";
import { RetailCouponModel } from "../models/retail-coupon.model";
import { birthdayPromotionCustomers } from "../../customer-management/contracts";
import { getModuleStateForCompany } from "../../../middleware/require-module";
import { BranchModel } from "../../../model/branch.model";
import { validateCouponInput } from "./retail-coupon.service";

export const birthdayProgramDefaults = {
  enabled: false, discountType: "percent" as const, value: 10, minSubtotal: 0,
  maxDiscount: null as number | null, validityDays: 7, version: 0,
};
const DAY = 86400000;
const vietnamDate = (now: Date) => new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);

/** Feb 29 birthdays are observed on Feb 28 in a non-leap year. */
export function birthdayWindow(dateOfBirth: Date, now: Date, validityDays: number) {
  const today = vietnamDate(now);
  const year = Number(today.slice(0, 4));
  for (const occurrenceYear of [year, year - 1]) {
    const month = dateOfBirth.getUTCMonth();
    const lastDay = new Date(Date.UTC(occurrenceYear, month + 1, 0)).getUTCDate();
    const day = Math.min(dateOfBirth.getUTCDate(), lastDay);
    const date = `${occurrenceYear}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const startsAt = new Date(`${date}T00:00:00+07:00`);
    const endsAt = new Date(+startsAt + validityDays * DAY);
    if (now >= startsAt && now < endsAt) return { year: occurrenceYear, startsAt, endsAt };
  }
  return null;
}
export function birthdayCandidateDays(now: Date, validityDays: number) {
  const localMidnight = new Date(`${vietnamDate(now)}T00:00:00Z`);
  const days = new Set<string>();
  for (let offset = 0; offset < validityDays; offset++) {
    const date = new Date(+localMidnight - offset * DAY).toISOString();
    days.add(date.slice(5, 10));
    if (date.slice(5, 10) === "02-28") days.add("02-29");
  }
  return [...days];
}
export function validateBirthdayProgram(input: any) {
  if (typeof input.enabled !== "boolean") throw new Error("Trạng thái chương trình không hợp lệ.");
  if (!Number.isSafeInteger(input.validityDays) || input.validityDays < 1 || input.validityDays > 90) throw new Error("Thời hạn mã ưu đãi phải từ 1 đến 90 ngày.");
  const validated = validateCouponInput({ ...input, code: "BIRTHDAY", name: "Quà sinh nhật", active: true,
    customerTierCodes: [], customerId: null, usageLimit: 1,
    startsAt: "2020-01-01T00:00:00Z", endsAt: "2099-01-01T00:00:00Z" });
  if (input.deliveryChannels !== undefined && (!Array.isArray(input.deliveryChannels) || input.deliveryChannels.some((channel: unknown) => channel !== "email"))) throw new Error("Chỉ hỗ trợ gửi mã qua Email. Zalo và số điện thoại đang phát triển.");
  return { ...(input.deliveryChannels !== undefined ? { deliveryChannels: [...new Set<"email">(input.deliveryChannels)] } : {}), enabled: input.enabled as boolean, validityDays: input.validityDays as number,
    discountType: validated.discountType, value: validated.value,
    minSubtotal: validated.minSubtotal, maxDiscount: validated.maxDiscount };
}
export const retailBirthdayProgramService = {
  async get(scope: RetailBranchScope) {
    return await RetailBirthdayProgramModel.findOne(scope).lean() || { ...birthdayProgramDefaults, ...scope };
  },
  async save(scope: RetailBranchScope, input: any, actor: string) {
    const values = validateBirthdayProgram(input);
    if (!Number.isSafeInteger(input.version) || input.version < 0) throw new Error("Phiên bản chương trình không hợp lệ.");
    try {
      const result = await RetailBirthdayProgramModel.findOneAndUpdate({ ...scope, version: input.version },
        { $set: { ...values, updatedBy: actor }, $inc: { version: 1 } },
        { returnDocument: "after", upsert: input.version === 0 });
      if (result) return result;
    } catch (error: any) { if (error.code !== 11000) throw error; }
    throw Object.assign(new Error("Chương trình đã thay đổi. Vui lòng tải lại trước khi lưu."), { status: 409 });
  },
};

export async function issueBirthdayCoupons(scope: RetailBranchScope, now = new Date(), customerId?: string) {
  const program = await RetailBirthdayProgramModel.findOne({ ...scope, enabled: true }).lean();
  if (!program) return 0;
  const branch = await BranchModel.exists({ _id: scope.branchId, companyCode: scope.companyCode, isActive: true });
  if (!branch) return 0;
  let issued = 0;
  const customers = birthdayPromotionCustomers(scope.companyCode, birthdayCandidateDays(now, program.validityDays), customerId);
  try {
    for await (const customer of customers) {
      const window = birthdayWindow(new Date(customer.dateOfBirth!), now, program.validityDays);
      if (!window) continue;
      const id = String(customer._id);
      const issuanceKey = `birthday:${id}:${window.year}`;
      try {
        const result = await RetailCouponModel.updateOne({ ...scope, issuanceKey }, { $setOnInsert: {
          ...scope, issuanceKey, code: `SN${window.year}${id}`.toUpperCase(), name: `Quà sinh nhật ${window.year}`,
          ...(program.deliveryChannels?.includes("email") ? { emailDelivery: { status: "pending" } } : {}),
          customerId: id, customerName: customer.name, customerCode: customer.customerCode,
          customerTierCodes: [], source: "birthday", discountType: program.discountType, value: program.value,
          minSubtotal: program.minSubtotal, maxDiscount: program.maxDiscount, usageLimit: 1, usedCount: 0,
          startsAt: window.startsAt, endsAt: window.endsAt, active: true, version: 0,
          createdBy: "birthday-scheduler", updatedBy: "birthday-scheduler",
        } }, { upsert: true });
        issued += result.upsertedCount;
      } catch (error: any) {
        // Another worker may have created this customer's yearly gift first.
        if (error.code !== 11000 || !await RetailCouponModel.exists({ ...scope, issuanceKey })) throw error;
      }
    }
  } finally { await customers.close(); }
  return issued;
}

export async function runBirthdayCouponScan(now = new Date()) {
  let issued = 0;
  for await (const program of RetailBirthdayProgramModel.find({ enabled: true }).lean().cursor()) {
    try {
      const state = await getModuleStateForCompany(program.companyCode);
      if (!state.exists || !state.modules?.includes("retail")) continue;
      issued += await issueBirthdayCoupons({ companyCode: program.companyCode, branchId: program.branchId }, now);
    } catch (error) { console.error("[birthday-coupons]", program.companyCode, program.branchId, error); }
  }
  return issued;
}
export function startRetailBirthdayCouponScheduler() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runBirthdayCouponScan(); }
    catch (error) { console.error("[birthday-coupons] scan failed", error); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), 5 * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
