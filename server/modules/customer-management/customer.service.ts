import { Types, type ClientSession } from "mongoose";
import { CustomerError } from "./customer-errors";
import { appendCustomerNotes } from "./customer-notes";
import { formatCustomerCode, normalizeCustomerInput, normalizePhone, phoneLookupVariants } from "./customer-normalization";
import type { CustomerInput, CustomerStatus, CustomerType, ICustomer } from "./interfaces/customer.interface";
import { CustomerCounterModel } from "./models/customer-counter.model";
import { CustomerModel } from "./models/customer.model";

export type CustomerScope = { companyCode: string };
export type CustomerActor = { id: string; name: string };
export type CustomerListQuery = {
  q?: string;
  status?: CustomerStatus | "all";
  type?: CustomerType;
  customerKind?: NonNullable<ICustomer["customerKind"]> | "unclassified";
  page?: number;
  limit?: number;
};

type StoredCustomer = ICustomer & { _id: unknown };

export interface CustomerRepository {
  list(filter: Record<string, unknown>, skip: number, limit: number): Promise<StoredCustomer[]>;
  count(filter: Record<string, unknown>): Promise<number>;
  nextSequence(scope: CustomerScope, session?: ClientSession): Promise<number>;
  findByPhone(scope: CustomerScope, normalizedPhone: string, session?: ClientSession): Promise<StoredCustomer | null>;
  create(values: Record<string, unknown>, session?: ClientSession): Promise<StoredCustomer>;
  findById(scope: CustomerScope, id: string): Promise<StoredCustomer | null>;
  updateWithVersion(scope: CustomerScope, id: string, version: number, values: Record<string, unknown>): Promise<StoredCustomer | null>;
  setStatus(scope: CustomerScope, id: string, version: number, status: CustomerStatus): Promise<StoredCustomer | null>;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildCustomerListFilter(scope: CustomerScope, query: CustomerListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    companyCode: scope.companyCode,
    ...(query.status === "all" ? {} : { status: query.status || "active" }),
    ...(query.type ? { type: query.type } : {}),
  };
  if (query.customerKind === "individual" || query.customerKind === "business") {
    filter.customerKind = query.customerKind;
  } else if (query.customerKind === "unclassified") {
    filter.customerKind = { $nin: ["individual", "business"] };
  }
  const q = String(query.q || "").trim();
  if (q) {
    const pattern = new RegExp(escapeRegex(q), "i");
    const isPhoneQuery = /^[\d\s()+.-]+$/.test(q);
    const normalizedPhoneQuery = isPhoneQuery ? normalizePhone(q) : "";
    const normalizedPhoneVariants = normalizedPhoneQuery ? phoneLookupVariants(normalizedPhoneQuery) : [];
    filter.$or = [
      { customerCode: pattern }, { name: pattern }, { phone: pattern },
      { normalizedPhone: pattern },
      ...normalizedPhoneVariants.map((phone) => ({ normalizedPhone: new RegExp(escapeRegex(phone), "i") })),
      { email: pattern },
    ];
  }
  return filter;
}

function requireId(id: string): void {
  if (!Types.ObjectId.isValid(id)) throw new CustomerError("CUSTOMER_ID_INVALID", "Mã khách hàng không hợp lệ.");
}

function duplicatePhoneError(): CustomerError {
  return new CustomerError("CUSTOMER_PHONE_EXISTS", "Đã có khách dùng số này. Hãy chọn hồ sơ có sẵn hoặc xác nhận tạo hồ sơ riêng.", 409);
}

function isDuplicatePhoneKey(error: unknown): boolean {
  const failure = error as { code?: unknown; keyPattern?: Record<string, unknown> } | undefined;
  return failure?.code === 11000 && Boolean(failure.keyPattern?.normalizedPhone || failure.keyPattern?.phoneIdentityKey);
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

    async create(scope: CustomerScope, input: CustomerInput | Record<string, unknown>, actor: CustomerActor, session?: ClientSession) {
      const values = normalizeCustomerInput(input);
      if (input.allowSharedPhone !== true && await repository.findByPhone(scope, values.normalizedPhone, session)) throw duplicatePhoneError();
      const sequence = await repository.nextSequence(scope, session);
      try {
        return await repository.create({
          ...values,
          phoneIdentityKey: input.allowSharedPhone === true ? null : values.normalizedPhone,
          customerKind: values.customerKind || "individual",
          source: values.source || "manual",
          companyCode: scope.companyCode,
          customerCode: formatCustomerCode(scope.companyCode, sequence),
          createdBy: actor.id,
          createdByName: actor.name,
          version: 0,
        }, session);
      } catch (error) {
        if (isDuplicatePhoneKey(error)) throw duplicatePhoneError();
        throw error;
      }
    },

    async detail(scope: CustomerScope, id: string) {
      requireId(id);
      const customer = await repository.findById(scope, id);
      if (!customer) throw new CustomerError("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.", 404);
      return customer;
    },

    async update(scope: CustomerScope, id: string, input: CustomerInput | Record<string, unknown>, version: number) {
      requireId(id);
      const current = await repository.findById(scope, id);
      if (!current) throw new CustomerError("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.", 404);
      // Capture only submitted extra information, never metadata from the stored record.
      const values = normalizeCustomerInput({ ...current, ...input }, input);
      const changedPhone = values.normalizedPhone !== normalizePhone(current.phone);
      if (input.allowSharedPhone !== true && changedPhone) {
        const samePhone = await repository.findByPhone(scope, values.normalizedPhone);
        if (samePhone && String(samePhone._id) !== id) throw duplicatePhoneError();
      }
      try {
        const updated = await repository.updateWithVersion(scope, id, version, {
          ...values,
          ...(changedPhone ? { phoneIdentityKey: input.allowSharedPhone === true ? null : values.normalizedPhone } : {}),
        });
        if (updated) return updated;
      } catch (error) {
        if (isDuplicatePhoneKey(error)) throw duplicatePhoneError();
        throw error;
      }
      throw new CustomerError("CUSTOMER_VERSION_CONFLICT", "Hồ sơ đã được thay đổi ở nơi khác. Vui lòng tải lại.", 409);
    },

    async appendNotes(scope: CustomerScope, id: string, additions: readonly string[]) {
      requireId(id);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = await repository.findById(scope, id);
        if (!current) throw new CustomerError("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.", 404);
        const notes = appendCustomerNotes(current.notes, additions);
        if (notes === String(current.notes ?? "").trim()) return current;
        const updated = await repository.updateWithVersion(scope, id, current.version, { notes });
        if (updated) return updated;
      }
      throw new CustomerError("CUSTOMER_VERSION_CONFLICT", "Hồ sơ đã được thay đổi ở nơi khác. Vui lòng thử lại.", 409);
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
  nextSequence: async (scope, session) => {
    const counter = await CustomerCounterModel.findOneAndUpdate(
      { companyCode: scope.companyCode },
      { $inc: { sequence: 1 } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, session },
    ).lean();
    return counter!.sequence;
  },
  findByPhone: (scope, normalizedPhone, session) => CustomerModel.findOne({ ...scope, normalizedPhone: { $in: phoneLookupVariants(normalizedPhone) } }).session(session ?? null).lean() as any,
  create: async (values, session) => {
    const { phoneIdentityKey: _phoneIdentityKey, ...customer } = (await new CustomerModel(values).save({ session })).toObject();
    return customer;
  },
  findById: (scope, id) => CustomerModel.findOne({ _id: id, ...scope }).lean() as any,
  updateWithVersion: (scope, id, version, values) => CustomerModel.findOneAndUpdate(
    { _id: id, ...scope, version }, { $set: values, $inc: { version: 1 } }, { returnDocument: 'after', runValidators: true },
  ).lean() as any,
  setStatus: (scope, id, version, status) => CustomerModel.findOneAndUpdate(
    { _id: id, ...scope, version }, { $set: { status }, $inc: { version: 1 } }, { returnDocument: 'after', runValidators: true },
  ).lean() as any,
};

export const CustomerService = createCustomerService(mongooseRepository);
