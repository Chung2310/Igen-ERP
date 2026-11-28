import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/database";
import { runNextAssistantFeedbackPatch } from "../assistant/feedback-patch-worker";

let stopping = false;
process.once("SIGTERM", () => { stopping = true; });
process.once("SIGINT", () => { stopping = true; });

async function main() {
  if (process.env.ASSISTANT_FEEDBACK_AUTOPATCH_ENABLED !== "true") {
    throw new Error("Set ASSISTANT_FEEDBACK_AUTOPATCH_ENABLED=true for the feedback patch worker.");
  }
  await connectDB();
  try {
    while (!stopping) {
      try {
        if (!await runNextAssistantFeedbackPatch()) await new Promise(resolve => setTimeout(resolve, 2_000));
      } catch {
        console.error("[assistant-feedback-patch] Queue unavailable; retrying.");
        await new Promise(resolve => setTimeout(resolve, 5_000));
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch(() => {
  console.error("[assistant-feedback-patch] Startup failed.");
  process.exitCode = 1;
});
