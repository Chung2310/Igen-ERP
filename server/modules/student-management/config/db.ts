import "dotenv/config";
import mongoose from "mongoose";
import { logger } from "./logger";

export async function connectDB() {
  let uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/student_management";
  
  const user = process.env.MONGODB_USER;
  const password = process.env.MONGODB_PASSWORD;
  const authSource = process.env.MONGODB_AUTH_SOURCE || "admin";

  if (user && password && !uri.includes("@")) {
    const match = uri.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/);
    if (match) {
      const prefix = match[1];
      const rest = match[2];
      const querySeparator = rest.includes("?") ? "&" : "?";
      uri = `${prefix}${encodeURIComponent(user)}:${encodeURIComponent(password)}@${rest}${querySeparator}authSource=${authSource}`;
    }
  }

  // Mask credentials in logs for security
  const maskedUri = uri.replace(/:([^@:]+)@/, ":******@");
  logger.info(`[Database] Connecting to MongoDB: ${maskedUri}`);

  try {
    await mongoose.connect(uri);
    logger.info("MongoDB connected successfully");
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    process.exit(1);
  }
}
