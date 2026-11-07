import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/database";
import { startQuotationWorker } from "../modules/quotation/jobs";

let runtime: Awaited<ReturnType<typeof startQuotationWorker>> | undefined;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 25_000);
  timeout.unref();
  await runtime?.close();
  await mongoose.disconnect();
  clearTimeout(timeout);
}
process.once("SIGTERM", () => { void stop(); });
process.once("SIGINT", () => { void stop(); });
async function main() {
  if (process.env.QUOTATION_WORKERS_ENABLED !== "true") throw new Error("Set QUOTATION_WORKERS_ENABLED=true to run the quotation worker.");
  if (!process.env.QUOTATION_QUEUE_PREFIX) throw new Error("QUOTATION_QUEUE_PREFIX must be unique per environment.");
  await connectDB();
  runtime = await startQuotationWorker();
}
void main().catch(error => {
  console.error("[quotation-worker]", error instanceof Error ? error.message : "Startup failed");
  process.exitCode = 1;
  void stop();
});
