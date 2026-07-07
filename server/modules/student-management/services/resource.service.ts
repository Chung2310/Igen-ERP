import { Resource } from "../models/resource.model";
import { IResource, IResourceBooking } from "../interfaces/resource.interface";
import { logger } from "../config/logger";

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

// Hai khung giờ giao nhau khi start < otherEnd và end > otherStart
function isOverlapping(a: IResourceBooking, b: IResourceBooking): boolean {
  if (a.date !== b.date) return false;
  return a.startTime < b.endTime && a.endTime > b.startTime;
}

export class ResourceService {
  static async createResource(ownerId: string, data: ResourceData): Promise<IResource> {
    logger.info(`[Resource] Creating resource for ownerId=${ownerId}, name=${data.name}`);
    const resource = new Resource({ ...data, ownerId });
    const saved = await resource.save();
    logger.info(`[Resource] Resource created: id=${saved._id}, name=${saved.name}`);
    return saved;
  }

  static async getResources(ownerId: string | string[], filters: ResourceFilters) {
    const page = filters.page ? parseInt(String(filters.page)) : 1;
    const limit = filters.limit ? parseInt(String(filters.limit)) : 1000;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = buildOwnerQuery(ownerId);
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

  static async getResourceById(ownerId: string | string[], id: string): Promise<IResource | null> {
    return await Resource.findOne({ _id: id, ...buildOwnerQuery(ownerId) });
  }

  static async updateResource(ownerId: string | string[], id: string, data: ResourceData): Promise<IResource | null> {
    logger.info(`[Resource] Updating resource: id=${id}`);
    return await Resource.findOneAndUpdate(
      { _id: id, ...buildOwnerQuery(ownerId) },
      { $set: data },
      { new: true, runValidators: true }
    );
  }

  static async deleteResource(ownerId: string | string[], id: string): Promise<IResource | null> {
    logger.info(`[Resource] Deleting resource: id=${id}`);
    return await Resource.findOneAndDelete({ _id: id, ...buildOwnerQuery(ownerId) });
  }

  /** Đặt lịch sử dụng tài nguyên, kiểm tra trùng khung giờ */
  static async bookResource(ownerId: string | string[], id: string, booking: IResourceBooking): Promise<IResource> {
    const resource = await Resource.findOne({ _id: id, ...buildOwnerQuery(ownerId) });
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
  static async cancelBooking(ownerId: string | string[], id: string, bookingId: string): Promise<IResource> {
    const resource = await Resource.findOne({ _id: id, ...buildOwnerQuery(ownerId) });
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
  static async getBookingsInRange(ownerId: string | string[], from?: string, to?: string) {
    const resources = await Resource.find(buildOwnerQuery(ownerId));
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
