import mongoose from "mongoose";
import dotenv from "dotenv";
import { UserModel } from "../server/model/user.model";
import { RolePermissionModel } from "../server/model/role-permission.model";

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

  await mongoose.connect(connectionUri);
  console.log("Connected to MongoDB.");

  const targetEmail = "vngchua@igen.com";
  const userDoc = await UserModel.findOne({ email: targetEmail });
  if (!userDoc) {
    console.log(`User ${targetEmail} not found!`);
  } else {
    console.log("=== USER DOCUMENT ===");
    console.log(JSON.stringify(userDoc.toObject(), null, 2));

    const rolePerm = await RolePermissionModel.findOne({
      companyCode: userDoc.companyCode,
      role: userDoc.role
    });
    console.log("=== ROLE PERMISSIONS IN DB ===");
    console.log(rolePerm ? JSON.stringify(rolePerm.toObject(), null, 2) : "No custom role configuration found.");
  }

  await mongoose.connection.close();
}

run().catch(console.error);
