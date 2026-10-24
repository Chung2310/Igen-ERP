import { AiSubscriptionPlanModel, type SubscriptionPlanRecord } from "../model/ai-subscription.model";

const DEFAULT_PLANS: Pick<SubscriptionPlanRecord, "code" | "name" | "description" | "durationDays" | "aiLimit" | "priceVnd">[] = [
  { code: "AI_BASIC_30", name: "Cơ bản", description: "Phù hợp để bắt đầu sử dụng AI cho nội dung và trả lời Facebook.", durationDays: 30, aiLimit: 500, priceVnd: 99_000 },
  { code: "AI_STANDARD_30", name: "Tiêu chuẩn", description: "Dành cho doanh nghiệp sử dụng Campaign và Message Facebook thường xuyên.", durationDays: 30, aiLimit: 2_000, priceVnd: 299_000 },
  { code: "AI_ADVANCED_30", name: "Nâng cao", description: "Hạn mức rộng hơn cho nhiều chiến dịch và nhu cầu trả lời khách hàng mỗi ngày.", durationDays: 30, aiLimit: 5_000, priceVnd: 599_000 },
];

/** Insert missing catalog entries only; never overwrite Superadmin edits or grant quota. */
export async function seedAiSubscriptionPlans(): Promise<number> {
  await AiSubscriptionPlanModel.init();
  let inserted = 0;
  for (const plan of DEFAULT_PLANS) {
    const now = new Date();
    try {
      const result = await AiSubscriptionPlanModel.updateOne({ code: plan.code }, {
        $setOnInsert: { ...plan, active: true, createdBy: "system:ai-subscription-seed", createdAt: now, updatedAt: now },
      }, { upsert: true, runValidators: true, timestamps: false });
      inserted += result.upsertedCount;
    } catch (error) {
      // Another application instance may have inserted the same code concurrently.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  return inserted;
}
