import type { FinanceBranchScope } from "../contracts";

type RetryableReminderDependencies = {
  listDeliveries(filter: Record<string, unknown>, skip: number, limit: number): Promise<any[]>;
  countDeliveries(filter: Record<string, unknown>): Promise<number>;
  listReceivables(scope: FinanceBranchScope, ids: string[]): Promise<any[]>;
};

const boundedInteger = (value: unknown, fallback: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(1, parsed)) : fallback;
};

export function createRetryableFinanceReminderAssistantService(dependencies: RetryableReminderDependencies) {
  return {
    async list(scope: FinanceBranchScope, input: { page?: unknown; limit?: unknown } = {}) {
      const page = boundedInteger(input.page, 1, 10_000);
      const limit = boundedInteger(input.limit, 20, 100);
      const filter = {
        ...scope,
        channel: "in_app",
        status: "failed",
        failureType: "temporary",
        $expr: { $lt: ["$attempt", "$maxAttempts"] },
      };
      const [deliveries, total] = await Promise.all([
        dependencies.listDeliveries(filter, (page - 1) * limit, limit),
        dependencies.countDeliveries(filter),
      ]);
      const receivableIds = [...new Set(deliveries.map((delivery) => String(delivery.receivableId || "")).filter(Boolean))];
      const receivables = receivableIds.length ? await dependencies.listReceivables(scope, receivableIds) : [];
      const byId = new Map(receivables.map((receivable) => [String(receivable._id), receivable]));
      const items = deliveries.flatMap((delivery) => {
        const receivable = byId.get(String(delivery.receivableId || ""));
        if (!receivable || String(delivery.channel) !== "in_app") return [];
        const payload = delivery.payload && typeof delivery.payload === "object" ? delivery.payload : {};
        const sourceCode = String(payload.sourceCode || receivable.sourceCode || receivable.receivableCode || "");
        const balance = Number(payload.balance ?? receivable.balance);
        const daysOverdue = Number(payload.daysOverdue ?? receivable.daysOverdue);
        return [{
          _id: String(delivery._id),
          customerName: String(receivable.customerName || "Khách hàng"),
          receivableCode: String(receivable.receivableCode || ""),
          sourceCode,
          balance,
          daysOverdue,
          notificationTitle: `Công nợ quá hạn · ${sourceCode}`,
          notificationBody: `Khoản công nợ còn ${balance} ₫ và đã quá hạn ${daysOverdue} ngày.`,
          attempt: Number(delivery.attempt || 0),
          maxAttempts: Number(delivery.maxAttempts || 0),
          nextAttemptAt: delivery.nextAttemptAt,
          createdAt: delivery.createdAt,
        }];
      });
      return { items, total, page, limit };
    },
  };
}
