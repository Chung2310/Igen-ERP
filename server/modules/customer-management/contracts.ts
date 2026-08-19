import type { CustomerStatus, CustomerType } from "./interfaces/customer.interface";
import { CustomerService, type CustomerActor, type CustomerScope } from "./customer.service";

export type CustomerBrief = {
  customerId: string;
  customerCode: string;
  name: string;
  phone: string;
  type: CustomerType;
  status: CustomerStatus;
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

    async quickCreateCustomer(scope: CustomerScope, input: { name: string; phone: string }, actor: CustomerActor): Promise<CustomerBrief> {
      return brief(await service.create(scope, { ...input, source: "pos" }, actor));
    },
  };
}

export const { searchActiveCustomers, getCustomerBrief, quickCreateCustomer } = createCustomerContracts(CustomerService);
