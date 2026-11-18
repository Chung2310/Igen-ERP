import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/database";
import { runNextAssistantJob } from "../assistant/jobs";
let stopping=false;
process.once("SIGTERM",()=>{stopping=true;});
process.once("SIGINT",()=>{stopping=true;});
async function main() {
  if (process.env.ASSISTANT_BACKGROUND_ENABLED!=="true") throw new Error("Set ASSISTANT_BACKGROUND_ENABLED=true for the assistant worker.");
  await connectDB();
  try {
    while (!stopping) {
      try {
        if (!await runNextAssistantJob()) await new Promise(resolve=>setTimeout(resolve,1000));
      } catch { console.error("[assistant-worker] Queue unavailable; retrying."); await new Promise(resolve=>setTimeout(resolve,5000)); }
    }
  } finally { await mongoose.disconnect(); }
}
void main().catch(()=>{console.error("[assistant-worker] Startup failed.");process.exitCode=1;});
