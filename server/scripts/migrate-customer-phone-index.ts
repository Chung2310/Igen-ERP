import mongoose from "mongoose";
import { CustomerModel } from "../modules/customer-management/models/customer.model";

export async function migrateCustomerPhoneIndex(apply: boolean) {
  const collection = CustomerModel.collection;
  const indexes = await collection.indexes();
  const legacy = indexes.filter(index => index.unique === true
    && index.key.companyCode === 1 && index.key.normalizedPhone === 1
    && Object.keys(index.key).length === 2);
  if (apply) {
    await CustomerModel.createIndexes();
    for (const index of legacy) {
      if (index.name) await collection.dropIndex(index.name).catch(error => {
        if ((error as { code?: number }).code !== 27) throw error;
      });
    }
  }
  return { oldUniqueIndexes: legacy.map(index => index.name), changed: apply && legacy.length > 0 };
}

async function main() {
  if (process.argv.slice(2).some(argument => argument !== "--apply")) throw new Error("Tham số hợp lệ: --apply.");
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Cần cung cấp MONGODB_URI của cơ sở dữ liệu đích.");
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, retryWrites: false });
  try {
    console.log(JSON.stringify(await migrateCustomerPhoneIndex(process.argv.includes("--apply"))));
  } finally {
    await mongoose.disconnect();
  }
}

if (/migrate-customer-phone-index\.[cm]?[jt]s$/i.test(process.argv[1] || "")) {
  void main().catch(error => {
    console.error(error instanceof Error ? error.message : "Không chuyển được chỉ mục số điện thoại.");
    process.exitCode = 1;
  });
}
