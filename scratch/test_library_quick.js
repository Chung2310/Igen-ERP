import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { heygenService } from "../server/service/heygen.service.ts";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/igen-erp");
  
  // Test with superadmin user ID
  const result = await heygenService.getLibrary("6a27b91c79eee5d1979c63ab", true);
  
  console.log("=== HEYGEN LIBRARY RESULT ===");
  console.log("Status:", result.status);
  console.log("Avatars Count:", result.avatars.length);
  console.log("Voices Count:", result.voices.length);
  console.log("Defaults:", result.defaults);
  console.log("Warnings:", result.warnings);
  console.log("\nAvatars:");
  result.avatars.forEach((a, i) => {
    console.log(`  ${i + 1}. ${a.name} (${a.id}) | isCustom=${a.isCustom} | type=${a.avatarType || "N/A"}`);
  });
  
  await mongoose.disconnect();
}

run().catch(console.error);
