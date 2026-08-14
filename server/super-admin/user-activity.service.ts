import { UserModel } from "../model/user.model";
import { USER_ACTIVITY_CATEGORIES, UserActivityEventModel } from "../model/user-activity-event.model";

const startOfDay = (value: string | undefined, fallback: Date) => {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid from date");
  return date;
};
const endOfDay = (value: string | undefined, fallback: Date) => {
  if (!value) return fallback;
  const date = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid to date");
  return date;
};

export function createUserActivityService(deps: any) {
  return {
    async list(input: any) {
      const user = await deps.users.find(input.userId);
      if (!user) throw new Error("User not found");
      if (input.tenantId !== "SYSTEM" && user.companyCode !== input.tenantId) throw new Error("User is outside tenant scope");

      const now = new Date();
      const defaultFrom = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); defaultFrom.setUTCHours(0, 0, 0, 0);
      const from = startOfDay(input.from, defaultFrom);
      const to = endOfDay(input.to, now);
      if (from > to) throw new Error("from date must not be after to date");
      if (input.category && !USER_ACTIVITY_CATEGORIES.includes(input.category)) throw new Error("Invalid activity category");

      const page = Math.max(Number(input.page) || 1, 1);
      const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 100);
      const filter: any = { userId: input.userId, occurredAt: { $gte: from, $lte: to } };
      if (input.tenantId !== "SYSTEM") filter.companyCode = input.tenantId;
      if (input.category) filter.category = input.category;
      if (input.result) {
        if (!["success", "failure"].includes(input.result)) throw new Error("Invalid activity result");
        filter.result = input.result;
      }
      if (input.search?.trim()) {
        const escaped = String(input.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 100);
        filter.description = { $regex: escaped, $options: "i" };
      }
      const [data, total] = await Promise.all([
        deps.activities.find(filter, { skip: (page - 1) * limit, limit }),
        deps.activities.count(filter),
      ]);
      return { data, total, page, limit };
    },
  };
}

export const userActivityService = createUserActivityService({
  users: { find: (id: string) => UserModel.findById(id).select("_id companyCode").lean() },
  activities: { find: (filter: any, options: any) => UserActivityEventModel.find(filter, options), count: (filter: any) => UserActivityEventModel.countDocuments(filter) },
});
