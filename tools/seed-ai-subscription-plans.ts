import "dotenv/config";
import mongoose from "mongoose";
import { seedAiSubscriptionPlans } from "../server/modules/marketing-suite/shared/service/ai-subscription-seed";

// Run: npx tsx tools/seed-ai-subscription-plans.ts
// Only inserts missing plans; does not assign subscriptions or change existing plans.
async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://mongodb/igen-erp";
  const separateAuth = process.env.MONGODB_USER && process.env.MONGODB_PASSWORD && !uri.replace(/^mongodb(?:\+srv)?:\/\//, "").includes("@");
  try {
    await mongoose.connect(uri, {
      retryWrites: false, serverSelectionTimeoutMS: 10_000,
      ...(separateAuth ? {
        user: process.env.MONGODB_USER, pass: process.env.MONGODB_PASSWORD,
        authSource: process.env.MONGODB_AUTH_SOURCE || "admin",
      } : {}),
    });
    const inserted = await seedAiSubscriptionPlans();
    console.log(`AI subscription seed: inserted ${inserted} plan(s); existing plans preserved.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(() => {
  console.error("Không thể thêm gói AI. Kiểm tra kết nối MongoDB và chạy lại lệnh seed.");
  process.exitCode = 1;
});
