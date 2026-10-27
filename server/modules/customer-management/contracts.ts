import type { CustomerStatus, CustomerType, ICustomerTierState } from "./interfaces/customer.interface";
import { CustomerService, type CustomerActor, type CustomerScope } from "./customer.service";
import { CustomerModel } from "./models/customer.model";
import { Types, type ClientSession } from "mongoose";
import { CustomerSettingsService } from "./services/customer-settings.service";
export { getBillingProfile } from "./billing-profile.service";

export type CustomerBrief = {
  customerId: string;
  customerCode: string;
  name: string;
  phone: string;
  type: CustomerType;
  status: CustomerStatus;
  tier?: Pick<ICustomerTierState, "code" | "name">;
};

export type CustomerContact = CustomerBrief & {
  email?: string;
};

type CustomerContractService = Pick<typeof CustomerService, "list" | "detail" | "create">;

const brief = (customer: any): CustomerBrief => ({
  customerId: String(customer._id),
  customerCode: customer.customerCode,
  name: customer.name,
  phone: customer.phone,
  type: customer.type,
  status: customer.status,
  ...(customer.tier?.code && customer.tier?.name ? { tier: { code: customer.tier.code, name: customer.tier.name } } : {}),
});

const contact = (customer: any): CustomerContact => ({
  ...brief(customer),
  ...(customer.email ? { email: customer.email } : {}),
});

export function createCustomerContracts(service: CustomerContractService) {
  return {
    async searchActiveCustomers(scope: CustomerScope, q: string, limit = 10): Promise<CustomerBrief[]> {
      const result = await service.list(scope, {
        q: String(q || "").trim(), status: "active", page: 1,
        limit: Math.min(20, Math.max(1, Number(limit) || 10)),
      });
      return result.items.map(brief);
    },

    async getCustomerBrief(scope: CustomerScope, customerId: string, options: { includeInactive?: boolean } = {}): Promise<CustomerBrief | null> {
      try {
        const customer = await service.detail(scope, customerId);
        if (customer.status !== "active" && !options.includeInactive) return null;
        return brief(customer);
      } catch (error) {
        if ((error as { code?: string })?.code === "CUSTOMER_NOT_FOUND") return null;
        throw error;
      }
    },

    async getCustomerContact(scope: CustomerScope, customerId: string, options: { includeInactive?: boolean } = {}): Promise<CustomerContact | null> {
      try {
        const customer = await service.detail(scope, customerId);
        if (customer.status !== "active" && !options.includeInactive) return null;
        return contact(customer);
      } catch (error) {
        if ((error as { code?: string })?.code === "CUSTOMER_NOT_FOUND") return null;
        throw error;
      }
    },

    async quickCreateCustomer(scope: CustomerScope, input: { name: string; phone: string }, actor: CustomerActor): Promise<CustomerBrief> {
      return brief(await service.create(scope, { ...input, source: "pos" }, actor));
    },
  };
}

export const { searchActiveCustomers, getCustomerBrief, getCustomerContact, quickCreateCustomer } = createCustomerContracts(CustomerService);

export { CustomerPointService } from "./services/customer-point.service";

/** Bậc phân hạng của công ty — nguồn duy nhất là cài đặt module Khách hàng. */
export async function getCustomerTiers(companyCode: string): Promise<ICustomerTierState[]> {
  const settings = await CustomerSettingsService.getSettings(companyCode);
  return settings.customerTiers.map((tier) => ({
    code: tier.code,
    name: tier.name,
    minGrossProfit: Number(tier.minGrossProfit ?? tier.minSpend ?? 0),
    minSpend: Number(tier.minSpend ?? tier.minGrossProfit ?? 0),
    color: tier.color,
    pointMultiplier: tier.pointMultiplier,
    discountPercent: tier.discountPercent,
  }));
}

/** Ghi hạng đã tính lại lên hồ sơ khách. Không đụng `version` vì đây không phải sửa đổi của người dùng. */
export async function applyCustomerTier(
  companyCode: string,
  customerId: string,
  tier: ICustomerTierState,
  tierGrossProfit: number,
  totalSales: number,
  now = new Date()
): Promise<void> {
  if (!Types.ObjectId.isValid(customerId)) return;
  await CustomerModel.updateOne(
    { _id: customerId, companyCode: companyCode.toUpperCase() },
    {
      $set: {
        tier,
        tierGrossProfit: Number(tierGrossProfit || 0),
        tierTotalSales: Number(totalSales || 0),
        tierUpdatedAt: now,
      },
    },
  );
}

/** Hạng hiện tại của khách, đọc cùng transaction khi xác nhận đơn. */
export async function getCustomerTierForPromotion(companyCode: string, customerId: unknown, session?: ClientSession) {
  if (typeof customerId !== "string" || !Types.ObjectId.isValid(customerId)) return null;
  const customer = await CustomerModel.findOne({ _id: customerId, companyCode: companyCode.toUpperCase(), status: "active" })
    .select("tier.code").session(session ?? null).lean();
  return customer?.tier?.code || null;
}

/** Active customer identity, read from the owning module inside checkout's transaction. */
export async function getPromotionCustomer(companyCode: string, customerId: unknown, session?: ClientSession) {
  if (typeof customerId !== "string" || !Types.ObjectId.isValid(customerId)) return null;
  return CustomerModel.findOne({ _id: customerId, companyCode, status: "active" })
    .select("_id name customerCode tier dateOfBirth email").session(session ?? null).lean();
}

/** Stream birthday candidates without loading the entire customer directory into memory. */
export function birthdayPromotionCustomers(companyCode: string, monthDays: string[], customerId?: string) {
  return CustomerModel.find({ companyCode, status: "active", dateOfBirth: { $type: "date" },
    ...(customerId ? { _id: customerId } : {}),
    $expr: { $in: [{ $dateToString: { date: "$dateOfBirth", format: "%m-%d", timezone: "UTC", onNull: "" } }, monthDays] },
  }).select("_id name customerCode dateOfBirth").lean().cursor();
}
