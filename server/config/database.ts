import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel } from "../model/user.model";
import { PermissionModel } from "../model/permission.model";
import { RolePermissionModel } from "../model/role-permission.model";
import { PERMISSION_CATALOG } from "./permission-catalog";
import { dropLegacyPayrollRunPeriodKeyUniqueIndex } from "../model/payroll-run-index-migration";
import {
  dropLegacyAttendancePeriodResultUniqueIndex,
  dropLegacyPayrollOperationJobIdempotencyIndex,
} from "../model/payroll-branch-index-migration";

/**
 * Tá»± Ä‘á»™ng táº¡o tÃ i khoáº£n Super Admin náº¿u chÆ°a tá»“n táº¡i
 */
async function seedSuperAdmin() {
  try {
    // Äá»c SUPERADMIN_* (tÃªn cÅ© VITE_SUPERADMIN_* váº«n Ä‘Æ°á»£c cháº¥p nháº­n Ä‘á»ƒ tÆ°Æ¡ng thÃ­ch,
    // nhÆ°ng khÃ´ng nÃªn dÃ¹ng: tiá»n tá»‘ VITE_ khiáº¿n biáº¿n cÃ³ nguy cÆ¡ bá»‹ Ä‘Æ°a vÃ o bundle frontend).
    const saEmail = (process.env.SUPERADMIN_EMAIL || process.env.VITE_SUPERADMIN_EMAIL || "")
      .toLowerCase()
      .trim();
    const saPassword = process.env.SUPERADMIN_PASSWORD || process.env.VITE_SUPERADMIN_PASSWORD || "";
    const saName = process.env.SUPERADMIN_NAME || process.env.VITE_SUPERADMIN_NAME || "Super Admin";

    if (!saEmail || !saPassword) {
      console.warn(
        "[Backend Database] Bá» qua seed Super Admin: chÆ°a cáº¥u hÃ¬nh SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD."
      );
      return;
    }

    // 1. Kiá»ƒm tra xem Ä‘Ã£ cÃ³ báº¥t ká»³ tÃ i khoáº£n superadmin nÃ o trong há»‡ thá»‘ng chÆ°a
    const existingSA = await UserModel.findOne({ role: "superadmin" });
    if (existingSA) {
      console.log("[Backend Database] Super Admin Ä‘Ã£ tá»“n táº¡i trong database.");
      return;
    }

    // 2. Náº¿u chÆ°a cÃ³ superadmin, kiá»ƒm tra xem cÃ³ tÃ i khoáº£n trÃ¹ng email cáº¥u hÃ¬nh chÆ°a
    const userWithEmail = await UserModel.findOne({ email: saEmail });
    if (userWithEmail) {
      console.log(`[Backend Database] TÃ¬m tháº¥y tÃ i khoáº£n trÃ¹ng email ${saEmail}. NÃ¢ng cáº¥p lÃªn Super Admin...`);
      userWithEmail.role = "superadmin";
      await userWithEmail.save();
      console.log("[Backend Database] NÃ¢ng cáº¥p tÃ i khoáº£n lÃªn Super Admin thÃ nh cÃ´ng.");
      return;
    }

    // 3. Náº¿u chÆ°a cÃ³ cáº£ hai, tiáº¿n hÃ nh táº¡o má»›i tÃ i khoáº£n superadmin
    const hashedPassword = await bcrypt.hash(saPassword, 10);
    const superAdmin = new UserModel({
      email: saEmail,
      password: hashedPassword,
      displayName: saName,
      role: "superadmin",
      createdAt: new Date(),
      status: "offline",
    });

    await superAdmin.save();
    console.log(`[Backend Database] Khá»Ÿi táº¡o tÃ i khoáº£n Super Admin thÃ nh cÃ´ng: ${saEmail}`);
  } catch (error) {
    console.error("[Backend Database] Lá»—i khi tá»± Ä‘á»™ng khá»Ÿi táº¡o Super Admin:", error);
  }
}

/**
 * Tá»± Ä‘á»™ng seed danh sÃ¡ch mÃ£ quyá»n há»‡ thá»‘ng ban Ä‘áº§u
 */
async function allowMultipleSuperAdmins() {
  try {
    await UserModel.collection.dropIndex("unique_superadmin_role");
    console.log("[Backend Database] ÄÃ£ gá»¡ giá»›i háº¡n má»™t tÃ i khoáº£n Super Admin.");
  } catch (error: any) {
    if (error?.codeName !== "IndexNotFound" && error?.code !== 27) throw error;
  }
}

async function seedPermissions() {
  try {
    const defaultPermissions = [
      { code: "user:read", name: "Xem thÃ´ng tin nhÃ¢n sá»±", module: "user", description: "Xem danh sÃ¡ch vÃ  sÆ¡ Ä‘á»“ nhÃ¢n sá»± doanh nghiá»‡p" },
      { code: "user:manage", name: "Quáº£n trá»‹ nhÃ¢n sá»±", module: "user", description: "ThÃªm, sá»­a, xÃ³a tÃ i khoáº£n thÃ nh viÃªn trong doanh nghiá»‡p" },
      { code: "kanban:read", name: "Xem Kanban Task", module: "kanban", description: "Xem báº£ng cÃ´ng viá»‡c Kanban" },
      { code: "kanban:manage", name: "Quáº£n trá»‹ Kanban Task", module: "kanban", description: "Táº¡o, cáº­p nháº­t, phÃ¢n cÃ´ng, kÃ©o tháº£ vÃ  xÃ³a Kanban task" },
      { code: "project:read", name: "Xem Dá»± Ã¡n", module: "project", description: "Xem danh sÃ¡ch dá»± Ã¡n trong cÃ´ng ty" },
      { code: "project:manage", name: "Quáº£n trá»‹/Thiáº¿t láº­p Dá»± Ã¡n", module: "project", description: "Táº¡o má»›i, chá»‰nh sá»­a thÃ´ng tin dá»± Ã¡n" },
      { code: "stock:read", name: "Xem Nháº­t kÃ½ Kho", module: "stock", description: "Xem lá»‹ch sá»­ xuáº¥t nháº­p kho" },
      { code: "stock:manage", name: "Quáº£n trá»‹ Kho", module: "stock", description: "Táº¡o phiáº¿u nháº­p xuáº¥t kho hÃ ng" },
      { code: "hr:read", name: "Xem trang tá»•ng quan NhÃ¢n sá»±", module: "hr", description: "Xem tháº» vÃ  biá»ƒu Ä‘á»“ nhÃ¢n sá»± trÃªn trang Tá»•ng quan" },
      { code: "timekeeping:read", name: "Xem cháº¥m cÃ´ng (Tá»•ng quan)", module: "hr", description: "Xem tháº» cháº¥m cÃ´ng trÃªn trang Tá»•ng quan" },
      { code: "timekeeping:manage", name: "Quáº£n lÃ½ & duyá»‡t cháº¥m cÃ´ng", module: "hr", description: "Duyá»‡t Ä‘Æ¡n xin nghá»‰, chá»‰nh sá»­a báº£n ghi cháº¥m cÃ´ng vÃ  cáº¥u hÃ¬nh vá»‹ trÃ­/ca lÃ m viá»‡c" },
      { code: "payroll:read", name: "Xem báº£ng lÆ°Æ¡ng", module: "hr", description: "Xem báº£ng lÆ°Æ¡ng sau khi Ä‘Ã£ Ä‘Æ°á»£c tÃ­nh" },
      { code: "payroll:prepare", name: "Chuáº©n bá»‹ dá»¯ liá»‡u lÆ°Æ¡ng", module: "hr", description: "Táº¡o ká»³ lÆ°Æ¡ng, Ä‘á»“ng bá»™ vÃ  khÃ³a dá»¯ liá»‡u cháº¥m cÃ´ng trÆ°á»›c khi tÃ­nh lÆ°Æ¡ng" },
      { code: "payroll:manage", name: "Quáº£n lÃ½ & tÃ­nh lÆ°Æ¡ng", module: "hr", description: "Äá»“ng bá»™ cÃ´ng, khÃ³a cÃ´ng, tÃ­nh lÆ°Æ¡ng, duyá»‡t vÃ  chá»‘t ká»³ lÆ°Æ¡ng" },
      { code: "payroll:pay", name: "Payroll payment", module: "hr", description: "Confirm payroll payments" },
      { code: "company-email:manage", name: "Quáº£n lÃ½ email chÃºc má»«ng", module: "hr", description: "Cáº¥u hÃ¬nh máº«u vÃ  theo dÃµi email sinh nháº­t, lá»… Táº¿t cá»§a cÃ´ng ty" },
      { code: "recruitment:manage", name: "Quáº£n lÃ½ tuyá»ƒn dá»¥ng", module: "hr", description: "Quáº£n lÃ½ tin tuyá»ƒn dá»¥ng, á»©ng viÃªn, quy trÃ¬nh vÃ  phá»ng váº¥n theo chi nhÃ¡nh" },
      { code: "student:read", name: "Xem há»c viÃªn/khÃ¡ch hÃ ng", module: "student", description: "Xem tháº» há»c viÃªn/khÃ¡ch hÃ ng vÃ  há»c phÃ­ trÃªn trang Tá»•ng quan" },
      { code: "student:manage", name: "Quáº£n lÃ½ há»c viÃªn/khÃ¡ch hÃ ng", module: "student", description: "ThÃªm, sá»­a, xÃ³a há»c viÃªn, khÃ³a há»c, lá»›p, Ä‘á»‘i tÃ¡c..." },
      { code: "partner:read", name: "Xem Ä‘á»‘i tÃ¡c & cá»™ng tÃ¡c viÃªn", module: "partner", description: "Xem danh sÃ¡ch, chi tiáº¿t, sá»‘ liá»‡u giá»›i thiá»‡u vÃ  hoa há»“ng Ä‘á»‘i tÃ¡c" },
      { code: "partner:manage", name: "Quáº£n lÃ½ Ä‘á»‘i tÃ¡c & hoa há»“ng", module: "partner", description: "ThÃªm, sá»­a, xÃ³a, nháº­p Excel, cáº¥u hÃ¬nh level vÃ  ghi nháº­n chi tráº£ hoa há»“ng" },
      { code: "chat:read", name: "Xem trÃ² chuyá»‡n (Tá»•ng quan)", module: "chat", description: "Xem tháº» trÃ² chuyá»‡n trÃªn trang Tá»•ng quan" },
      { code: "resource:read", name: "Xem tÃ i nguyÃªn (Tá»•ng quan)", module: "resource", description: "Xem tháº» tÃ i nguyÃªn trÃªn trang Tá»•ng quan" },
      { code: "resource:manage", name: "Quáº£n lÃ½ tÃ i nguyÃªn & káº¿t ná»‘i Drive", module: "resource", description: "Káº¿t ná»‘i/ngáº¯t káº¿t ná»‘i Google Drive doanh nghiá»‡p vÃ  quáº£n lÃ½ thÆ° viá»‡n tÃ i nguyÃªn" }
    ];

    // XÃ³a cÃ¡c quyá»n cÅ© khÃ´ng cÃ²n sá»­ dá»¥ng trong dá»± Ã¡n
    await PermissionModel.deleteMany({
      code: { $in: ["crm:read", "crm:manage", "marketing:post"] }
    });

    const catalogPermissions = PERMISSION_CATALOG.map((entry) => ({
      code: entry.code,
      name: entry.label,
      module: entry.code.split(":")[0],
      description: entry.description,
    }));
    const permissionsByCode = new Map([...defaultPermissions, ...catalogPermissions].map((permission) => [permission.code, permission]));

    for (const perm of permissionsByCode.values()) {
      const result = await PermissionModel.updateOne({ code: perm.code }, { $setOnInsert: perm }, { upsert: true });
      if (result.upsertedCount) console.log(`[Backend Database] Khá»Ÿi táº¡o mÃ£ quyá»n máº·c Ä‘á»‹nh: ${perm.code}`);
    }

    await RolePermissionModel.updateMany(
      { role: "admin" },
<<<<<<< Updated upstream
<<<<<<< HEAD
      { $addToSet: { permissions: { $each: ["custom-field:manage", "student-settings:manage", "company-smtp:manage", "payroll:prepare"] } } },
=======
      { $addToSet: { permissions: { $each: ["custom-field:manage", "company-smtp:manage"] } } },
    );
    // Thu hồi quyền đã cấp trước đây: loại hình doanh nghiệp là đặc quyền SuperAdmin,
    // doanh nghiệp không được tự sửa.
    await RolePermissionModel.updateMany(
      { role: { $in: ["admin", "manager", "branch_owner", "user"] } },
      { $pull: { permissions: "student-settings:manage" } },
>>>>>>> origin/develop
=======
      { $addToSet: { permissions: { $each: ["custom-field:manage", "student-settings:manage", "company-smtp:manage", "payroll:prepare", "payroll:pay"] } } },
>>>>>>> Stashed changes
    );
    await RolePermissionModel.updateMany(
      { role: "manager" },
      { $addToSet: { permissions: "custom-field:manage" } },
    );
  } catch (error) {
    console.error("[Backend Database] Lá»—i khi tá»± Ä‘á»™ng khá»Ÿi táº¡o mÃ£ quyá»n:", error);
  }
}

/**
 * Khá»Ÿi táº¡o káº¿t ná»‘i cÆ¡ sá»Ÿ dá»¯ liá»‡u MongoDB
 */
export async function connectDB() {
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

  // Log URI áº©n máº­t kháº©u Ä‘á»ƒ dá»… debug cáº¥u hÃ¬nh trÃªn VPS
  const redactedUri = connectionUri.replace(/:([^:@]+)@/, ":******@");
  console.log(`[Backend Database] Äang káº¿t ná»‘i tá»›i MongoDB qua URI: ${redactedUri}`);

  try {
    await mongoose.connect(connectionUri);
    console.log(`[Backend Database] Káº¿t ná»‘i MongoDB thÃ nh cÃ´ng. db=${mongoose.connection.name || "unknown"} host=${mongoose.connection.host || "unknown"} instance=${process.env.INSTANCE_ID || process.env.HOSTNAME || "local"} pid=${process.pid}`);
    // Cháº¡y cÃ¡c seeder dá»¯ liá»‡u há»‡ thá»‘ng
    await allowMultipleSuperAdmins();
    await dropLegacyPayrollRunPeriodKeyUniqueIndex();
    await dropLegacyPayrollOperationJobIdempotencyIndex();
    await dropLegacyAttendancePeriodResultUniqueIndex();
    await seedSuperAdmin();
    await seedPermissions();
  } catch (error) {
    console.error("[Backend Database] Lá»—i káº¿t ná»‘i MongoDB:", error);
    process.exit(1);
  }
}
