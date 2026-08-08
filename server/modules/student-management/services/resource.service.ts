import { Resource } from "../models/resource.model";
import { IResource, IResourceBooking } from "../interfaces/resource.interface";
import { logger } from "../config/logger";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";
import {
  customFieldWriteService,
  CustomFieldWriteConflictError,
  expectedVersionOf,
  type CustomFieldWriteContext,
} from "./custom-field-write.service";
import { customFieldResourceService } from "./custom-field-resource.service";

interface ResourceFilters {
  page?: number | string;
  limit?: number | string;
  type?: string;
  status?: string;
  search?: string;
}

interface ResourceData {
  [key: string]: unknown;
}

function buildOwnerQuery(ownerId: string | string[]): Record<string, unknown> {
  if (ownerId === "ALL") return {};
  return { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
}

function buildBranchScopeQuery(branchId?: string): Record<string, unknown> {
  return branchId ? { branchId } : {};
}

// Hai khung giờ giao nhau khi start < otherEnd và end > otherStart
function isOverlapping(a: IResourceBooking, b: IResourceBooking): boolean {
  if (a.date !== b.date) return false;
  return a.startTime < b.endTime && a.endTime > b.startTime;
}

export class ResourceService {
  static customFieldWrites = customFieldWriteService;

  static async createResource(ownerId: string, data: ResourceData, context: CustomFieldWriteContext): Promise<IResource> {
    logger.info(`[Resource] Creating resource for ownerId=${ownerId}, name=${data.name}`);
    const writeData = await this.customFieldWrites.prepareCreate(context, data);
    const resource = new Resource({ ...writeData, ownerId });
    const saved = await resource.save();
    await customFieldResourceService.finalizeEntity(context, saved);
    logger.info(`[Resource] Resource created: id=${saved._id}, name=${saved.name}`);
    return saved;
  }

  static async getResources(ownerId: string | string[], filters: ResourceFilters, branchId?: string) {
    const page = filters.page ? parseInt(String(filters.page)) : 1;
    const limit = filters.limit ? parseInt(String(filters.limit)) : 1000;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) };
    if (filters.type) query.type = filters.type;
    if (filters.status) query.status = filters.status;
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { identifier: { $regex: filters.search, $options: "i" } },
      ];
    }

    const total = await Resource.countDocuments(query);
    const resources = await Resource.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return { resources, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  static async getResourceById(ownerId: string | string[], id: string, branchId?: string): Promise<IResource | null> {
    return await Resource.findOne({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
  }

  static async updateResource(
    ownerId: string | string[],
    id: string,
    data: ResourceData,
    context: CustomFieldWriteContext,
    branchId?: string,
  ): Promise<IResource | null> {
    logger.info(`[Resource] Updating resource: id=${id}`);
    const query = { _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) };
    const existing = await Resource.findOne(query);
    if (!existing) return null;
    const expectedVersion = expectedVersionOf(data);
    const targetContext = context.actorRole === "superadmin" ? { ...context, tenantId: await resolveCustomFieldTenantForOwner(existing.ownerId) } : context;
    const writeData = await this.customFieldWrites.prepareUpdate(targetContext, existing, data);
    const updated = await Resource.findOneAndUpdate(
      { ...query, ...(expectedVersion === undefined ? {} : { __v: expectedVersion }) },
      { $set: writeData, $inc: { __v: 1 } },
      { new: true, runValidators: true }
    );
    if (!updated) throw new CustomFieldWriteConflictError();
    await customFieldResourceService.finalizeEntity(targetContext, updated);
    return updated;
  }

  static async deleteResource(ownerId: string | string[], id: string, branchId?: string): Promise<IResource | null> {
    logger.info(`[Resource] Deleting resource: id=${id}`);
    return await Resource.findOneAndDelete({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
  }

  /** Đặt lịch sử dụng tài nguyên, kiểm tra trùng khung giờ */
  static async bookResource(ownerId: string | string[], id: string, booking: IResourceBooking, branchId?: string): Promise<IResource> {
    const resource = await Resource.findOne({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    if (!resource) {
      throw new Error("Không tìm thấy tài nguyên.");
    }
    if (resource.status === "MAINTENANCE") {
      throw new Error("Tài nguyên đang bảo dưỡng, không thể đặt lịch.");
    }
    if (booking.startTime >= booking.endTime) {
      throw new Error("Giờ bắt đầu phải trước giờ kết thúc.");
    }

    const conflict = resource.bookings.find(b => isOverlapping(b, booking));
    if (conflict) {
      throw new Error(
        `Trùng lịch: "${conflict.purpose}" (${conflict.startTime} - ${conflict.endTime} ngày ${conflict.date}, người đặt: ${conflict.by}).`
      );
    }

    resource.bookings.push(booking);

    // Nếu booking rơi vào hiện tại thì chuyển trạng thái OCCUPIED
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const hhmm = now.toTimeString().slice(0, 5);
    if (booking.date === today && booking.startTime <= hhmm && booking.endTime > hhmm) {
      resource.status = "OCCUPIED";
    }

    const saved = await resource.save();
    logger.info(`[Resource] Booking added: resourceId=${id}, date=${booking.date} ${booking.startTime}-${booking.endTime}`);
    return saved;
  }

  /** Hủy một lịch đặt */
  static async cancelBooking(ownerId: string | string[], id: string, bookingId: string, branchId?: string): Promise<IResource> {
    const resource = await Resource.findOne({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    if (!resource) {
      throw new Error("Không tìm thấy tài nguyên.");
    }
    const before = resource.bookings.length;
    resource.bookings = resource.bookings.filter(b => String(b._id) !== bookingId) as typeof resource.bookings;
    if (resource.bookings.length === before) {
      throw new Error("Không tìm thấy lịch đặt cần hủy.");
    }
    if (resource.status === "OCCUPIED") {
      resource.status = "AVAILABLE";
    }
    const saved = await resource.save();
    logger.info(`[Resource] Booking cancelled: resourceId=${id}, bookingId=${bookingId}`);
    return saved;
  }

  /** Lấy toàn bộ booking trong khoảng ngày (phục vụ lịch tổng hợp) */
  static async getBookingsInRange(ownerId: string | string[], from?: string, to?: string, branchId?: string) {
    const resources = await Resource.find({ ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    const events: { id: string; title: string; date: string; time: string; details: string }[] = [];
    for (const resource of resources) {
      for (const b of resource.bookings) {
        if (from && b.date < from) continue;
        if (to && b.date > to) continue;
        events.push({
          id: `${resource._id}-${b._id}`,
          title: `${b.by} sử dụng ${resource.name}`,
          date: b.date,
          time: `${b.startTime} - ${b.endTime}`,
          details: `${b.purpose} • ${resource.identifier}`,
        });
      }
    }
    return events;
  }
}
