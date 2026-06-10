import mongoose from "mongoose";
import dotenv from "dotenv";
import { PermissionModel } from "../server/model/permission.model";

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI || "mongodb://mongodb/igen-erp";
  const user = process.env.MONGODB_USER;
  const pass = process.env.MONGODB_PASSWORD;
  const authSource = process.env.MONGODB_AUTH_SOURCE || "admin";

  let connectionUri = uri;
  if (user && pass) {
    const protocol = uri.startsWith("mongodb+srv://") ? "mongodb+srv://" : "mongodb://";
    const uriWithoutProtocol = uri.replace(protocol, "");
    if (!uriWithoutProtocol.includes("@")) {
      connectionUri = `${protocol}${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${uriWithoutProtocol}`;
    }
    if (authSource && !connectionUri.includes("authSource=")) {
      const separator = connectionUri.includes("?") ? "&" : "?";
      connectionUri = `${connectionUri}${separator}authSource=${authSource}`;
    }
  }

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(connectionUri);
  console.log("Connected. Cleaning up test permissions...");

  const result = await PermissionModel.deleteMany({
    code: { $regex: /^test_/ }
  });

  console.log(`Successfully deleted ${result.deletedCount} test permissions.`);
  await mongoose.connection.close();
  console.log("Done.");
}

run().catch(console.error);
