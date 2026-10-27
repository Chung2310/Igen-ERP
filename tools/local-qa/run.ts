import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import mongoose, { type Model } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { fixtureDocument, fixtureId, recipes, type Scope } from "./fixtures";

const directory = path.resolve("tmp/local-qa");
await mkdir(path.join(directory, "mongo"), { recursive: true });
// This command deliberately accepts no Mongo URI and never loads repository .env.
process.env.DOTENV_CONFIG_PATH = path.join(directory, "no-external-config.env");
process.env.NODE_ENV = "test";
process.env.DEPLOYMENT_ENV = "staging";
process.env.JWT_ACCESS_SECRET = randomBytes(48).toString("hex");
process.env.JWT_REFRESH_SECRET = randomBytes(48).toString("hex");
process.env.SUPERADMIN_ENCRYPTION_KEY = randomBytes(32).toString("hex");
process.env.SEED_MOCK_USERS = "false";
process.env.ENABLE_FILE_LOGGING = "false";
// Some provider modules call dotenv.config() without honoring DOTENV_CONFIG_PATH.
// Keep the isolated process from importing production/staging provider credentials.
dotenv.config = () => ({ parsed: {} });
dotenv.configDotenv = () => ({ parsed: {} });
for (const key of Object.keys(process.env)) if (/SMTP|TWILIO|PAYOS|SEPAY|GEMINI|HEYGEN|CLOUDINARY|GOOGLE|FACEBOOK|ZALO|TELEGRAM|LOAD_TEST_BYPASS/.test(key)) delete process.env[key];

const repl = await MongoMemoryReplSet.create({
  instanceOpts: [{ port: 27119, dbPath: path.join(directory, "mongo"), launchTimeout: 60000 }],
  replSet: { count: 1, name: "igen-local-qa", storageEngine: "wiredTiger", ip: "127.0.0.1" },
});
const uri = repl.getUri("igen_qa_local");
if (!uri.startsWith("mongodb://127.0.0.1:27119/igen_qa_local")) throw new Error("Unexpected local QA database target");
process.env.MONGODB_URI = uri;
await mongoose.connect(uri);
if (process.argv.includes("--reset")) {
  // Only this tool's dedicated loopback database can ever be reset.
  if (mongoose.connection.name !== "igen_qa_local" || mongoose.connection.host !== "127.0.0.1" || mongoose.connection.port !== 27119) throw new Error("Refusing to reset non-QA database");
  await mongoose.connection.dropDatabase();
}
const { CompanyModel } = await import("../../server/model/company.model");
const { BranchModel } = await import("../../server/model/branch.model");
const { UserModel } = await import("../../server/model/user.model");
const { MODULE_KEYS } = await import("../../server/config/module-keys");
const { UserActivityEventModel } = await import("../../server/model/user-activity-event.model");
const credentialsPath = path.join(directory, "access.json");
let password: string;
try { password = JSON.parse(await readFile(credentialsPath, "utf8")).password; }
catch { password = `Qa1!${randomBytes(15).toString("base64url")}`; }
const hash = await bcrypt.hash(password, 10);
const retailDemoEmail = "abc@gmail.com";
const retailDemoPassword = "123456";
const retailDemoHash = await bcrypt.hash(retailDemoPassword, 10);
const log: any[] = [];
const errors: any[] = [];
const accounts: any[] = [];
const now = new Date();
const today = now.toISOString().slice(0, 10);
const makeId = fixtureId;
async function save(model: Model<any>, data: any) {
  const existing = await model.findById(data._id);
  if (existing) return existing;
  return model.create(data);
}
async function account(companyCode: string, role: string, branchId?: string) {
  const defaultEmail = `${companyCode.toLowerCase()}.${role}${branchId ? `.${branchId.slice(-5)}` : ""}@example.test`;
  const isRetailDemoAdmin = companyCode === "QA_EDU" && role === "admin";
  const email = isRetailDemoAdmin ? retailDemoEmail : defaultEmail;
  const passwordHash = isRetailDemoAdmin ? retailDemoHash : hash;
  const _id = makeId(defaultEmail);
  const user = await save(UserModel, { _id, email, password: hash, displayName: `${role} kiểm thử ${companyCode}`, role: role === "cashier" ? "user" : role, companyCode, companyName: companyCode, branchId, level: role === "admin" ? 1 : role === "branch_owner" ? 2 : role === "manager" ? 3 : 4, monthlySalary: 12000000, department: "Vận hành", permissions: role === "cashier" ? ["retail:manage", "retail:read", "customer:read", "inventory:read"] : [] });
  const sessionId = randomUUID();
  await UserModel.updateOne({ _id }, { $set: { email, activeSessionId: sessionId, password: passwordHash } });
  accounts.push({ _id, email, role: user.role, companyCode, branchId, sessionId });
  return _id;
}

const models = new Map<string, Model<any>>();
for (const recipe of recipes) {
  const exported = await import(pathToFileURL(path.resolve("server", recipe.file)).href);
  const expectedName = ({ attendance: "TimekeepingLog", receivable: "FinanceReceivable" } as Record<string, string>)[recipe.key] || path.basename(recipe.file, ".model.ts").replaceAll("-", "");
  const model = Object.values(exported).find((value: any) => value?.schema && value.modelName?.toLowerCase() === expectedName.toLowerCase()) as Model<any>;
  if (!model) throw new Error(`No model for ${recipe.file}`);
  models.set(recipe.key, model);
}
for (const [companyCode, businessType] of [["QA_EDU", "education"], ["QA_LABOR", "labor"]] as const) {
  await save(CompanyModel, { _id: makeId(companyCode), code: companyCode, name: businessType === "education" ? "Doanh nghiệp giáo dục kiểm thử" : "Doanh nghiệp lao động kiểm thử", ownerEmail: `${companyCode.toLowerCase()}.admin@example.test`, businessType, enabledModules: MODULE_KEYS.filter((key) => key !== (businessType === "education" ? "worker" : "student")) });
  const adminId = await account(companyCode, "admin");
  for (const branchCode of ["HN", "HCM"]) {
    const branchId = makeId(`${companyCode}:${branchCode}`);
    console.log(`Seeding ${companyCode}/${branchCode}`);
    await save(BranchModel, { _id: branchId, companyCode, code: branchCode, name: `${companyCode} - ${branchCode}`, address: "Địa chỉ kiểm thử local", locationConfig: { latitude: 10.7769, longitude: 106.7009, allowedRadius: 1000, allowedPublicIps: ["127.0.0.1"] } });
    const employees = await Promise.all(["manager", "user", "cashier", "branch_owner", ...(businessType === "education" ? ["teacher"] : [])].map((role) => account(companyCode, role, branchId)));
    for (const recipe of recipes.filter((item) => !item.only || item.only === businessType)) {
      const model = models.get(recipe.key)!;
      for (let index = 0; index < (recipe.count ?? 3); index++) {
        const tag = `${companyCode}-${branchCode}-${index + 1}`;
        const scope: Scope = { companyCode, branchId, adminId, employeeId: employees[index], tag, index, today, id: (key) => makeId(`${companyCode}:${branchCode}:${key}:${index}`) };
        try {
          const doc = fixtureDocument(model, scope, recipe);
          if (!await model.exists({ _id: doc._id })) await doc.save();
          log.push({ module: recipe.module, model: model.modelName, id: String(doc._id), companyCode, branchId });
        } catch (error) { errors.push({ recipe: recipe.key, companyCode, branchCode, index, message: error instanceof Error ? error.message : String(error) }); }
      }
    }
    for (let index = 0; index < 60; index++) {
      const eventId = `qa-v1-${companyCode}-${branchCode}-${index}`;
      if (await UserActivityEventModel.countDocuments({ eventId })) continue;
      const failure = index % 7 === 0;
      await UserActivityEventModel.create({ eventId, userId: new mongoose.Types.ObjectId(employees[index % 3]), companyCode, branchId: new mongoose.Types.ObjectId(branchId), actionType: ["inventory.view", "company.create", "user.update", "order.create", "auth.login"][index % 5], category: index % 5 === 4 ? "authentication" : "data", result: failure ? "failure" : "success", method: "POST", description: `Mẫu QA: ${["xem kho", "tạo chi nhánh", "cập nhật tài khoản", "tạo đơn hàng", "đăng nhập"][index % 5]}${failure ? " bị từ chối" : " thành công"}`, sourceIp: "127.0.0.1", deviceSummary: "Trình duyệt kiểm thử local", occurredAt: new Date(now.getTime() - index * 60000) });
    }
  }
}

// Dữ liệu thử luồng Đối tác bán lẻ → Chính sách / Hoa hồng sản phẩm.
// ID và mã cố định giúp chạy lại seed mà không ghi đè các cấu hình đã sửa trên UI.
const demoCompany = "QA_EDU";
const demoActor = makeId("qa_edu.admin@example.test");
const { ProductCatalogCategoryModel } = await import("../../server/model/product-catalog-resource.model");
const { ProductCatalogModel } = await import("../../server/model/product-catalog.model");
const { ProductVariantModel } = await import("../../server/model/product-variant.model");
const { RetailPartnerModel } = await import("../../server/modules/retail/models/retail-partner.model");
const { RetailCommissionBasePolicyModel, RetailCommissionPolicyModel, RetailProductCommissionModel } = await import("../../server/modules/retail/models/retail-commission.model");
async function demo(model: Model<any>, key: string, values: Record<string, unknown>) {
  const document = await save(model, { _id: makeId(`retail-commission-demo:${key}`), companyCode: demoCompany, createdBy: demoActor, updatedBy: demoActor, ...values });
  log.push({ module: "retail-commission-demo", model: model.modelName, id: String(document._id), companyCode: demoCompany });
  return document;
}

for (const category of [
  { code: "QA", name: "Thiết bị mẫu có sẵn" },
  { code: "QA-DT", name: "Điện thoại kiểm thử" },
  { code: "QA-PK", name: "Phụ kiện kiểm thử" },
  { code: "QA-PK-SAC", name: "Sạc và cáp", parentCode: "QA-PK" },
]) await demo(ProductCatalogCategoryModel, `category:${category.code}`, { ...category, normalizedName: category.name.toLocaleLowerCase("vi"), status: "active" });

const phone = await demo(ProductCatalogModel, "product:phone", { productCode: "QA-PHONE", name: "Điện thoại QA 15", normalizedName: "dien thoai qa 15", productType: "physical", categoryCode: "QA-DT", baseUnitCode: "CAI", status: "active" });
const cable = await demo(ProductCatalogModel, "product:cable", { productCode: "QA-CABLE", name: "Cáp sạc USB-C QA", normalizedName: "cap sac usb-c qa", productType: "physical", categoryCode: "QA-PK-SAC", baseUnitCode: "CAI", status: "active" });
const caseProduct = await demo(ProductCatalogModel, "product:case", { productCode: "QA-CASE", name: "Ốp lưng QA 15", normalizedName: "op lung qa 15", productType: "physical", categoryCode: "QA-PK", baseUnitCode: "CAI", status: "active" });
for (const variant of [
  { sku: "QA-PHONE-128", productId: String(phone._id), displayName: "QA 15 · 128 GB", trackingMode: "serial" },
  { sku: "QA-PHONE-256", productId: String(phone._id), displayName: "QA 15 · 256 GB", trackingMode: "serial" },
  { sku: "QA-CABLE-C", productId: String(cable._id), displayName: "USB-C 1 m", trackingMode: "quantity" },
  { sku: "QA-CASE-01", productId: String(caseProduct._id), displayName: "Ốp trong suốt", trackingMode: "quantity" },
]) await demo(ProductVariantModel, `variant:${variant.sku}`, { ...variant, unitCode: "CAI", status: "active" });

const an = await demo(RetailPartnerModel, "partner:an", { code: "QA-CTV-AN", name: "Nguyễn An · CTV bán lẻ QA", roles: ["collaborator"], phone: "0900000101", email: "qa-ctv-an@example.test", address: "Quận 1, TP. Hồ Chí Minh", status: "active" });
const binh = await demo(RetailPartnerModel, "partner:binh", { code: "QA-CTV-BINH", name: "Trần Bình · CTV bán lẻ QA", roles: ["collaborator"], phone: "0900000102", email: "qa-ctv-binh@example.test", address: "Quận 3, TP. Hồ Chí Minh", status: "active" });
await demo(RetailPartnerModel, "partner:inactive", { code: "QA-CTV-NGUNG", name: "CTV bán lẻ đã ngừng QA", roles: ["collaborator"], status: "inactive" });
await demo(RetailPartnerModel, "partner:dealer", { code: "QA-DAI-LY", name: "Đại lý kiểm thử QA", roles: ["dealer"], status: "active" });

for (const policy of [
  { key: "global", partnerId: "", effectiveAt: new Date("2026-01-01T00:00:00+07:00"), config: { phoneAmount: 200_000, accessoryBps: 1_000, repairBps: 1_000 } },
  { key: "an", partnerId: String(an._id), effectiveAt: new Date("2026-06-01T00:00:00+07:00"), config: { phoneAmount: 250_000, accessoryBps: 1_200, repairBps: 1_100 } },
  { key: "future", partnerId: "", effectiveAt: new Date("2027-12-31T00:00:00+07:00"), config: { phoneAmount: 300_000, accessoryBps: 1_500, repairBps: 1_500 } },
]) await demo(RetailCommissionBasePolicyModel, `policy:${policy.key}`, { partnerId: policy.partnerId, effectiveAt: policy.effectiveAt, config: policy.config });

await demo(RetailProductCommissionModel, "override:phone", { sku: "QA-PHONE-128", rule: { kind: "phone", amount: 300_000 } });
await demo(RetailProductCommissionModel, "override:cable", { sku: "QA-CABLE-C", rule: { kind: "accessory", rateBps: 1_500 } });
await demo(RetailProductCommissionModel, "default:phone", { sku: "QA-PHONE-256", rule: null });
await demo(RetailCommissionPolicyModel, "legacy:case", { partnerId: String(binh._id), kind: "sale", sku: "QA-CASE-01", ratePercent: 8, active: true, effectiveFrom: new Date("2026-02-01T00:00:00+07:00") });

for (const [code, lifecycleStatus] of [["QA_EMPTY", "active"], ["QA_PAUSED", "suspended"]]) {
  await save(CompanyModel, { _id: makeId(code), code, name: code === "QA_EMPTY" ? "Doanh nghiệp chưa có dữ liệu" : "Doanh nghiệp bị tạm ngưng", ownerEmail: `${code.toLowerCase()}.admin@example.test`, lifecycleStatus, businessType: "education" });
  await account(code, "admin");
}
await account("SYSTEM", "superadmin");
await writeFile(credentialsPath, JSON.stringify({ url: "http://127.0.0.1:3120", database: "igen_qa_local", password, retailDemo: { email: retailDemoEmail, password: retailDemoPassword, companyCode: "QA_EDU" }, accounts: accounts.map(({ sessionId: _session, ...safe }) => safe) }, null, 2));
await writeFile(path.join(directory, "seed-report.json"), JSON.stringify({ at: now.toISOString(), database: "igen_qa_local", modules: [...new Set(log.map((entry) => entry.module))], records: log.length, accounts: accounts.length, errors, data: log }, null, 2));
console.log(JSON.stringify({ database: "igen_qa_local", fixtureRecords: log.length, accounts: accounts.length, modules: [...new Set(log.map((entry) => entry.module))], errors: errors.length, report: "tmp/local-qa/seed-report.json" }));
if (errors.length) {
  console.error(JSON.stringify(errors, null, 2));
  await mongoose.disconnect(); await repl.stop({ doCleanup: false }); process.exitCode = 1;
} else {
  const { startQaApi } = await import("./smoke");
  const { server, results } = await startQaApi({ directory, accounts });
  await writeFile(path.join(directory, "smoke-report.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ smokePassed: results.filter((item) => item.passed).length, smokeFailed: results.filter((item) => !item.passed).length, url: "http://127.0.0.1:3120" }));
  if (process.argv.includes("--serve")) {
    console.log("Local QA API and database are running. Credentials: tmp/local-qa/access.json");
    const stop = async () => { server.close(); await mongoose.disconnect(); await repl.stop({ doCleanup: false }); process.exit(); };
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
  } else { await new Promise<void>((resolve) => server.close(() => resolve())); await mongoose.disconnect(); await repl.stop({ doCleanup: false }); }
  if (results.some((item) => !item.passed)) process.exitCode = 1;
}
