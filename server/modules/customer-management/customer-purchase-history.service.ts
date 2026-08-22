import { CustomerError } from "./customer-errors";
import { Types, type SortOrder } from "mongoose";
import type { CustomerScope } from "./customer.service";
import { CustomerModel } from "./models/customer.model";
import { RetailOrderModel } from "../retail/models/retail-order.model";

type PurchaseHistoryOrder = {
  _id: unknown;
  orderCode?: string;
  status?: string;
  businessDate?: string;
  grandTotal?: number;
  paidAmount?: number;
  dueAmount?: number;
  items?: Array<{ quantity?: number }>;
  salespersonName?: string;
};

export interface CustomerPurchaseHistoryRepository {
  customer(scope: CustomerScope, customerId: string): Promise<unknown | null>;
  orders(filter: Record<string, unknown>, sort: Record<string, SortOrder>): Promise<PurchaseHistoryOrder[]>;
}

const numberValue = (value: unknown) => Number(value) || 0;
const completedPurchase = (order: PurchaseHistoryOrder) => order.status === "confirmed" || order.status === "completed";

export function createCustomerPurchaseHistoryService(repository: CustomerPurchaseHistoryRepository) {
  return {
    async get(scope: CustomerScope, customerId: string, branchId: string) {
      if (!Types.ObjectId.isValid(customerId)) throw new CustomerError("CUSTOMER_ID_INVALID", "Mã khách hàng không hợp lệ.");
      const normalizedBranchId = String(branchId || "").trim();
      if (!normalizedBranchId) throw new CustomerError("CUSTOMER_BRANCH_REQUIRED", "Chi nhánh là bắt buộc.", 400);
      const customer = await repository.customer(scope, customerId);
      if (!customer) throw new CustomerError("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.", 404);

      const items = await repository.orders(
        { companyCode: scope.companyCode, branchId: normalizedBranchId, customerId },
        { businessDate: -1, _id: -1 },
      );
      const purchases = items.filter(completedPurchase);
      const lastPurchase = purchases.find((order) => order.businessDate);
      return {
        summary: {
          orderCount: items.length,
          totalPurchased: purchases.reduce((total, order) => total + numberValue(order.grandTotal), 0),
          totalPaid: purchases.reduce((total, order) => total + numberValue(order.paidAmount), 0),
          currentDebt: items.filter((order) => order.status === "confirmed").reduce((total, order) => total + numberValue(order.dueAmount), 0),
          lastPurchaseAt: lastPurchase?.businessDate,
        },
        items: items.map((order) => ({
          _id: String(order._id),
          orderCode: order.orderCode,
          status: order.status,
          businessDate: order.businessDate,
          grandTotal: numberValue(order.grandTotal),
          paidAmount: numberValue(order.paidAmount),
          dueAmount: numberValue(order.dueAmount),
          itemCount: (order.items || []).reduce((total, item) => total + numberValue(item.quantity), 0),
          salespersonName: order.salespersonName,
        })),
      };
    },
  };
}

const repository: CustomerPurchaseHistoryRepository = {
  customer: (scope, customerId) => CustomerModel.findOne({ _id: customerId, ...scope }).lean(),
  orders: (filter, sort) => RetailOrderModel.find(filter).sort(sort).lean() as any,
};

export const CustomerPurchaseHistoryService = createCustomerPurchaseHistoryService(repository);
