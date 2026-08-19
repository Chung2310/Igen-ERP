import { Types } from "mongoose";
import { CustomerError } from "./customer-errors";
import { formatCustomerCode, normalizeCustomerInput } from "./customer-normalization";
import type { CustomerInput, CustomerStatus, CustomerType, ICustomer } from "./interfaces/customer.interface";
import { CustomerCounterModel } from "./models/customer-counter.model";
import { CustomerModel } from "./models/customer.model";

export type CustomerScope = { companyCode: string };
export type CustomerActor = { id: string; name: string };
export type CustomerListQuery = {
  q?: string;
  status?: CustomerStatus;
  type?: CustomerType;
  page?: number;
  limit?: number;
};

type StoredCustomer = ICustomer & { _id: unknown };

export interface CustomerRepository {
  list(filter: Record<string, unknown>, skip: number, limit: number): Promise<StoredCustomer[]>;
  count(filter: Record<string, unknown>): Promise<number>;
  nextSequence(scope: CustomerScope): Promise<number>;
  findByPhone(scope: CustomerScope, normalizedPhone: string): Promise<StoredCustomer | null>;
  create(values: Record<string, unknown>): Promise<StoredCustomer>;
  findById(scope: CustomerScope, id: string): Promise<StoredCustomer | null>;
  updateWithVersion(scope: CustomerScope, id: string, version: number, values: Record<string, unknown>): Promise<StoredCustomer | null>;
  setStatus(scope: CustomerScope, id: string, version: number, status: CustomerStatus): Promise<StoredCustomer | null>;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildCustomerListFilter(scope: CustomerScope, query: CustomerListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    companyCode: scope.companyCode,
    status: query.status || "active",
    ...(query.type ? { type: query.type } : {}),
  };
  const q = String(query.q || "").trim();
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { customerCode: pattern }, { name: pattern }, { phone: pattern },
      { normalizedPhone: pattern }, { email: pattern },
    ];
  }
  return filter;
}

function requireId(id: string): void {
  if (!Types.ObjectId.isValid(id)) throw new CustomerError("CUSTOMER_ID_INVALID", "Mã khách hàng không hợp lệ.");
}

function duplicatePhoneError(): CustomerError {
  return new CustomerError("CUSTOMER_PHONE_EXISTS", "Số điện thoại đã thuộc một khách hàng khác.", 409);
}

function isDuplicateKey(error: unknown): boolean {
  return Number((error as { code?: unknown })?.code) === 11000;
}

export function createCustomerService(repository: CustomerRepository) {
  return {
    async list(scope: CustomerScope, query: CustomerListQuery = {}) {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
      const filter = buildCustomerListFilter(scope, query);
      const [items, total] = await Promise.all([
        repository.list(filter, (page - 1) * limit, limit),
        repository.count(filter),
      ]);
      return { items, total, page, limit };
    },

    async create(scope: CustomerScope, input: CustomerInput, actor: CustomerActor) {
      const values = normalizeCustomerInput(input);
      if (await repository.findByPhone(scope, values.normalizedPhone)) throw duplicatePhoneError();
      const sequence = await repository.nextSequence(scope);
      try {
        return await repository.create({
          ...values,
          source: values.source || "manual",
          companyCode: scope.companyCode,
          customerCode: formatCustomerCode(scope.companyCode, sequence),
          createdBy: actor.id,
          createdByName: actor.name,
          version: 0,
        });
      } catch (error) {
        if (isDuplicateKey(error)) throw duplicatePhoneError();
        throw error;
      }
    },

    async detail(scope: CustomerScope, id: string) {
      requireId(id);
      const customer = await repository.findById(scope, id);
      if (!customer) throw new CustomerError("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.", 404);
      return customer;
    },

    async update(scope: CustomerScope, id: string, input: CustomerInput, version: number) {
      requireId(id);
      const current = await repository.findById(scope, id);
      if (!current) throw new CustomerError("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.", 404);
      const values = normalizeCustomerInput({ ...current, ...input });
      const samePhone = await repository.findByPhone(scope, values.normalizedPhone);
      if (samePhone && String(samePhone._id) !== id) throw duplicatePhoneError();
      try {
        const updated = await repository.updateWithVersion(scope, id, version, values);
        if (updated) return updated;
      } catch (error) {
        if (isDuplicateKey(error)) throw duplicatePhoneError();
        throw error;
      }
      throw new CustomerError("CUSTOMER_VERSION_CONFLICT", "Hồ sơ đã được thay đổi ở nơi khác. Vui lòng tải lại.", 409);
    },

    async setStatus(scope: CustomerScope, id: string, status: CustomerStatus, version: number) {
      requireId(id);
      const updated = await repository.setStatus(scope, id, version, status);
      if (updated) return updated;
      if (!await repository.findById(scope, id)) throw new CustomerError("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.", 404);
      throw new CustomerError("CUSTOMER_VERSION_CONFLICT", "Hồ sơ đã được thay đổi ở nơi khác. Vui lòng tải lại.", 409);
    },
  };
}

const mongooseRepository: CustomerRepository = {
  list: (filter, skip, limit) => CustomerModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean() as any,
  count: (filter) => CustomerModel.countDocuments(filter),
  nextSequence: async (scope) => {
    const counter = await CustomerCounterModel.findOneAndUpdate(
      { companyCode: scope.companyCode },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return counter!.sequence;
  },
  findByPhone: (scope, normalizedPhone) => CustomerModel.findOne({ ...scope, normalizedPhone }).lean() as any,
  create: async (values) => (await CustomerModel.create(values)).toObject() as any,
  findById: (scope, id) => CustomerModel.findOne({ _id: id, ...scope }).lean() as any,
  updateWithVersion: (scope, id, version, values) => CustomerModel.findOneAndUpdate(
    { _id: id, ...scope, version }, { $set: values, $inc: { version: 1 } }, { new: true, runValidators: true },
  ).lean() as any,
  setStatus: (scope, id, version, status) => CustomerModel.findOneAndUpdate(
    { _id: id, ...scope, version }, { $set: { status }, $inc: { version: 1 } }, { new: true, runValidators: true },
  ).lean() as any,
};

export const CustomerService = createCustomerService(mongooseRepository);
