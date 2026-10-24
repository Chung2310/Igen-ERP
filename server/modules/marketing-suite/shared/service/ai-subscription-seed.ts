import { AiSubscriptionPlanModel, type SubscriptionPlanRecord } from "../model/ai-subscription.model";

const DEFAULT_PLANS: Pick<SubscriptionPlanRecord, "code" | "name" | "description" | "durationDays" | "aiLimit" | "priceVnd">[] = [
  { code: "AI_BASIC_30", name: "Cơ bản", description: "Phù hợp để bắt đầu sử dụng AI cho nội dung và trả lời Facebook.", durationDays: 30, aiLimit: 500, priceVnd: 99_000 },
  { code: "AI_STANDARD_30", name: "Tiêu chuẩn", description: "Dành cho doanh nghiệp sử dụng Campaign và Message Facebook thường xuyên.", durationDays: 30, aiLimit: 2_000, priceVnd: 299_000 },
  { code: "AI_ADVANCED_30", name: "Nâng cao", description: "Hạn mức rộng hơn cho nhiều chiến dịch và nhu cầu trả lời khách hàng mỗi ngày.", durationDays: 30, aiLimit: 5_000, priceVnd: 599_000 },
];

/** Seed the initial catalog once, so renaming a package never resurrects its old code. */
export async function seedAiSubscriptionPlans(): Promise<number> {
  await AiSubscriptionPlanModel.init();
  const database = AiSubscriptionPlanModel.db.db;
  if (!database) throw new Error("Database connection is required to seed AI plans");
  const markers = database.collection<{ _id: string; appliedAt: Date }>("system_migrations");
  const markerId = "ai-subscription-initial-catalog-v1";
  let inserted: number;
  try {
    inserted = await AiSubscriptionPlanModel.db.transaction(async (session) => {
      if (await markers.findOne({ _id: markerId }, { session })) return 0;
      let count = 0;
      for (const plan of DEFAULT_PLANS) {
        const now = new Date();
        const result = await AiSubscriptionPlanModel.updateOne({ code: plan.code }, {
          $setOnInsert: { ...plan, active: true, createdBy: "system:ai-subscription-seed", createdAt: now, updatedAt: now },
        }, { upsert: true, runValidators: true, timestamps: false, session });
        count += result.upsertedCount;
      }
      await markers.insertOne({ _id: markerId, appliedAt: new Date() }, { session });
      return count;
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000 || !await markers.findOne({ _id: markerId })) throw error;
    inserted = 0;
  }
  await retireUnpricedLegacyAiPlans();
  return inserted;
}

export async function retireUnpricedLegacyAiPlans(): Promise<number> {
  const result = await AiSubscriptionPlanModel.updateMany({
    code: { $in: ["PLUS", "PRO"] }, active: true, priceVnd: null,
  }, { $set: { active: false } }, { runValidators: true });
  return result.modifiedCount;
}
