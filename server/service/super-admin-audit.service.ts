import { AuditEventModel } from "../model/audit-event.model";
import { UserModel } from "../model/user.model";

export interface AuditFilters {
  actorSuperAdminId?: string;
  effectiveUserId?: string;
  companyCode?: string;
  environment?: string;
  riskClass?: string;
  result?: string;
  actionType?: string;
  startDate?: string;
  endDate?: string; correlationId?: string; entityType?: string; entityId?: string; projectId?: string; taskId?: string; workflowId?: string; tenantId?: string;
}

export interface Pagination {
  page: number;
  limit: number;
}

export const superAdminAuditService = {
  async queryEvents(filters: AuditFilters, pagination: Pagination) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (filters.actorSuperAdminId) {
      query.actorSuperAdminId = filters.actorSuperAdminId;
    }
    if (filters.effectiveUserId) {
      query.effectiveUserId = filters.effectiveUserId;
    }
    if (filters.companyCode) {
      query.companyCode = filters.companyCode;
    }
    if (filters.environment) {
      query.environment = filters.environment;
    }
    if (filters.riskClass) {
      query.riskClass = filters.riskClass;
    }
    if (filters.result) {
      query.result = filters.result;
    }
    if (filters.actionType) {
      query.actionType = { $regex: filters.actionType, $options: "i" };
    }

    for (const field of ["correlationId", "entityType", "entityId", "projectId", "taskId", "workflowId", "tenantId"] as const) {
      if (filters[field]) query[field] = filters[field];
    }
    if (filters.startDate || filters.endDate) {
      query.occurredAt = {};
      if (filters.startDate) {
        query.occurredAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.occurredAt.$lte = new Date(filters.endDate);
      }
    }

    const [events, total] = await Promise.all([
      AuditEventModel.find(
        query,
        null,
        { sort: { occurredAt: -1 }, skip, limit }
      ),
      AuditEventModel.countDocuments(query),
    ]);

    // Let's resolve Emails and DisplayNames for actors
    const actorIds = Array.from(new Set(events.map(e => String(e.actorSuperAdminId)).filter(Boolean)));
    const users = actorIds.length > 0 ? await UserModel.find({ _id: { $in: actorIds } }).select("email displayName").lean() : [];
    const userMap = new Map(users.map(u => [String(u._id), u]));

    const eventsWithUsers = events.map((event: any) => {
      const user = userMap.get(String(event.actorSuperAdminId));
      return {
        ...event,
        actorEmail: user?.email || "Chưa xác định",
        actorDisplayName: user?.displayName || "Chưa xác định",
      };
    });

    return {
      events: eventsWithUsers,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  },
};
