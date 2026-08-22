import type { CustomerStatus, CustomerType, ICustomerTierState } from "./interfaces/customer.interface";
import { CustomerService, type CustomerActor, type CustomerScope } from "./customer.service";
import { CustomerModel } from "./models/customer.model";
import { CustomerSettingsService } from "./services/customer-settings.service";
export { getBillingProfile } from "./billing-profile.service";

export type CustomerBrief = {
  customerId: string;
  customerCode: string;
  name: string;
  phone: string;
  type: CustomerType;
  status: CustomerStatus;
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

/** Bậc phân hạng của công ty — nguồn duy nhất là cài đặt module Khách hàng. */
export async function getCustomerTiers(companyCode: string): Promise<ICustomerTierState[]> {
  const settings = await CustomerSettingsService.getSettings(companyCode);
  return settings.customerTiers.map((tier) => ({ code: tier.code, name: tier.name, minSpend: Number(tier.minSpend) }));
}

/** Ghi hạng đã tính lại lên hồ sơ khách. Không đụng `version` vì đây không phải sửa đổi của người dùng. */
export async function applyCustomerTier(companyCode: string, customerId: string, tier: ICustomerTierState, totalSales: number, now = new Date()): Promise<void> {
  await CustomerModel.updateOne(
    { _id: customerId, companyCode: companyCode.toUpperCase() },
    { $set: { tier, tierTotalSales: totalSales, tierUpdatedAt: now } },
  );
}
