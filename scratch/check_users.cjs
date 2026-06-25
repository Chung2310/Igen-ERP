const mongoose = require("mongoose");
const MONGODB_URI = "mongodb://127.0.0.1:27017/igen-erp";

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");
  
  const db = mongoose.connection.db;
  const users = await db.collection("users").find({}).toArray();
  
  console.log("=== USERS ===");
  users.forEach(u => {
    console.log(`Email: ${u.email}, Role: ${u.role}, Company: ${u.companyCode}`);
  });
  
  await mongoose.disconnect();
}

run().catch(console.error);
