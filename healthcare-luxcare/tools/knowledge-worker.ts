import "dotenv/config";
import mongoose from "mongoose";
import { ensureKnowledgeIndexes, processKnowledgeJob } from "../server/assistant/knowledge/knowledge-job.service";
if (!process.env.MONGODB_URI) throw new Error("Cần cấu hình MONGODB_URI cho worker.");
await mongoose.connect(process.env.MONGODB_URI, {
  user: process.env.MONGODB_USER,
  pass: process.env.MONGODB_PASSWORD,
  authSource: process.env.MONGODB_AUTH_SOURCE || "admin",
});
await ensureKnowledgeIndexes();
let stopping = false;
process.once("SIGTERM", () => {
  stopping = true;
});
process.once("SIGINT", () => {
  stopping = true;
});
try {
  while (!stopping) {
    try {
      if (await processKnowledgeJob()) continue;
    } catch (error) {
      console.error("[KnowledgeWorker]", error instanceof Error ? error.message : "Job failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
} finally {
  await mongoose.disconnect();
}
