import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { heygenService } from "../server/service/heygen.service.ts";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/igen-erp");

  // Use a test user id that has HeyGen access (you can replace with an actual id)
  const testUserId = "6a27b91c79eee5d1979c63ab"; // replace if needed

  const result = await heygenService.getLibrary(testUserId, true);

  // Group avatars by a pseudo‑folder using avatar name (or id if name missing)
  const avatarsByFolder: Record<string, any[]> = {};
  result.avatars.forEach(av => {
    const folder = av.name || av.id;
    if (!avatarsByFolder[folder]) avatarsByFolder[folder] = [];
    avatarsByFolder[folder].push(av);
  });

  console.log("=== Avatar Groups (folder → count) ===");
  Object.entries(avatarsByFolder).forEach(([folder, list]) => {
    console.log(`${folder}: ${list.length}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
