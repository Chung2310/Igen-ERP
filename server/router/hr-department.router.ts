import { Router, type Response } from "express";
import Joi from "joi";
import { HrDepartmentModel } from "../model/hr-department.model";
import { UserModel } from "../model/user.model";
import { type AuthenticatedRequest, requireAuth, requirePermission } from "../middleware/auth";
import { requireModule } from "../middleware/require-module";
import { validateRequest } from "../middleware/validation";

export const hrDepartmentRouter = Router();
hrDepartmentRouter.use(requireAuth as any, requireModule("hr"));

const companyQuery = Joi.object({ companyCode: Joi.string().trim().max(80) });
const nameBody = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  companyCode: Joi.string().trim().max(80),
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9_-]+$/).max(30).allow(""),
  description: Joi.string().trim().max(500).allow(""),
  managerUid: Joi.string().hex().length(24).allow(""),
  sortOrder: Joi.number().integer().min(0).max(9999),
  isActive: Joi.boolean(),
});
const idParams = Joi.object({ id: Joi.string().hex().length(24).required() });
const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");
const nameKey = (name: string) => normalizeName(name).toLocaleLowerCase("vi");
async function metadata(body: any, companyCode: string) {
  const result: Record<string, unknown> = {};
  if (body.code !== undefined) result.code = String(body.code).trim().toUpperCase() || undefined;
  if (body.description !== undefined) result.description = String(body.description).trim();
  if (body.managerUid !== undefined) {
    const managerUid = String(body.managerUid || "");
    const manager = managerUid ? await UserModel.findOne({ _id: managerUid, companyCode }).select("displayName").lean() : null;
    if (managerUid && !manager) throw Object.assign(new Error("Người quản lý không thuộc doanh nghiệp."), { status: 400 });
    result.managerUid = managerUid || undefined;
    result.managerName = manager?.displayName || undefined;
  }
  if (body.sortOrder !== undefined) result.sortOrder = Number(body.sortOrder);
  if (body.isActive !== undefined) result.isActive = body.isActive;
  return result;
}
async function assignedUserIds(companyCode: string, normalizedName: string) {
  const users = await UserModel.find({ companyCode, department: { $nin: [null, ""] } }).select("_id department").lean();
  return users.filter(user => nameKey(String(user.department || "")) === normalizedName).map(user => user._id);
}

function company(req: AuthenticatedRequest): string {
  const requested = req.user?.role === "superadmin" ? req.body?.companyCode || req.query.companyCode : undefined;
  return String(requested || req.user?.companyCode || "").trim().toUpperCase();
}

function fail(res: Response, error: unknown, fallback: string) {
  if ((error as { status?: number })?.status === 400) return res.status(400).json({ message: (error as Error).message });
  if ((error as { code?: number })?.code === 11000) return res.status(409).json({ message: "Phòng ban này đã tồn tại." });
  console.error("[hr-departments]", error);
  return res.status(500).json({ message: fallback });
}

hrDepartmentRouter.get("/", requirePermission(["hr:read", "access:read"]) as any, validateRequest({ query: companyQuery }), async (req: AuthenticatedRequest, res) => {
  const companyCode = company(req);
  if (!companyCode) return res.status(400).json({ message: "Vui lòng chọn doanh nghiệp." });
  try {
    // Hồ sơ cũ chỉ lưu tên phòng ban. Đưa các tên này vào danh mục khi đọc lần đầu.
    const users = await UserModel.find({ companyCode, department: { $nin: [null, ""] } }).select("department").lean();
    const legacy = new Map<string, string>();
    const counts = new Map<string, number>();
    for (const user of users) {
      const name = normalizeName(String(user.department || ""));
      if (!name) continue;
      const key = nameKey(name);
      if (!legacy.has(key)) legacy.set(key, name);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (legacy.size) {
      try {
        await HrDepartmentModel.bulkWrite([...legacy.entries()].map(([normalizedName, name]) => ({
          updateOne: { filter: { companyCode, normalizedName }, update: { $setOnInsert: { companyCode, normalizedName, name } }, upsert: true },
        })), { ordered: false });
      } catch (error) {
        // Một request khác có thể vừa đồng bộ cùng tên phòng ban.
        if ((error as { code?: number })?.code !== 11000) throw error;
      }
    }
    const departments = await HrDepartmentModel.find({ companyCode }).sort({ sortOrder: 1, name: 1 }).lean();
    return res.json({ data: departments.map(department => ({
      id: String(department._id), name: department.name, code: department.code, description: department.description, managerUid: department.managerUid, managerName: department.managerName, sortOrder: department.sortOrder ?? 0, isActive: department.isActive !== false, employeeCount: counts.get(department.normalizedName) || 0,
    })) });
  } catch (error) { return fail(res, error, "Không thể tải phòng ban."); }
});

hrDepartmentRouter.post("/", requirePermission("access:manage") as any, validateRequest({ body: nameBody }), async (req: AuthenticatedRequest, res) => {
  const companyCode = company(req);
  if (!companyCode) return res.status(400).json({ message: "Vui lòng chọn doanh nghiệp." });
  const name = normalizeName(req.body.name);
  try {
    const department = await HrDepartmentModel.create({ companyCode, name, normalizedName: nameKey(name), ...await metadata(req.body, companyCode) });
    return res.status(201).json({ data: { id: String(department._id), name: department.name, employeeCount: 0, code: department.code, description: department.description, managerUid: department.managerUid, managerName: department.managerName, sortOrder: department.sortOrder, isActive: department.isActive } });
  } catch (error) { return fail(res, error, "Không thể thêm phòng ban."); }
});

hrDepartmentRouter.patch("/:id", requirePermission("access:manage") as any, validateRequest({ params: idParams, query: companyQuery, body: nameBody }), async (req: AuthenticatedRequest, res) => {
  const companyCode = company(req);
  if (!companyCode) return res.status(400).json({ message: "Vui lòng chọn doanh nghiệp." });
  try {
    const department = await HrDepartmentModel.findOne({ _id: req.params.id, companyCode });
    if (!department) return res.status(404).json({ message: "Không tìm thấy phòng ban." });
    const name = normalizeName(req.body.name);
    const normalizedName = nameKey(name);
    if (normalizedName !== department.normalizedName && await HrDepartmentModel.exists({ companyCode, normalizedName })) {
      return res.status(409).json({ message: "Phòng ban này đã tồn tại." });
    }
    const previous = department.toObject();
    const employeeIds = await assignedUserIds(companyCode, department.normalizedName);
    department.name = name;
    department.normalizedName = normalizedName;
    Object.assign(department, await metadata(req.body, companyCode));
    await department.save();
    // Hồ sơ nhân sự hiện lưu phòng ban bằng chuỗi; đổi tên phải cập nhật cùng danh mục.
    try {
      if (employeeIds.length) await UserModel.updateMany({ _id: { $in: employeeIds }, companyCode }, { $set: { department: name } });
    } catch (error) {
      Object.assign(department, {
        name: previous.name,
        normalizedName: previous.normalizedName,
        code: previous.code,
        description: previous.description,
        managerUid: previous.managerUid,
        managerName: previous.managerName,
        sortOrder: previous.sortOrder,
        isActive: previous.isActive,
      });
      await department.save();
      throw error;
    }
    return res.json({ data: { id: String(department._id), name, code: department.code, description: department.description, managerUid: department.managerUid, managerName: department.managerName, sortOrder: department.sortOrder, isActive: department.isActive } });
  } catch (error) { return fail(res, error, "Không thể đổi tên phòng ban."); }
});

hrDepartmentRouter.delete("/:id", requirePermission("access:manage") as any, validateRequest({ params: idParams, query: companyQuery }), async (req: AuthenticatedRequest, res) => {
  const companyCode = company(req);
  if (!companyCode) return res.status(400).json({ message: "Vui lòng chọn doanh nghiệp." });
  try {
    const department = await HrDepartmentModel.findOne({ _id: req.params.id, companyCode });
    if (!department) return res.status(404).json({ message: "Không tìm thấy phòng ban." });
    const assigned = await assignedUserIds(companyCode, department.normalizedName);
    if (assigned.length) return res.status(409).json({ message: "Phòng ban đang có nhân sự. Vui lòng chuyển nhân sự sang phòng ban khác trước khi xóa." });
    await department.deleteOne();
    return res.json({ data: { id: req.params.id } });
  } catch (error) { return fail(res, error, "Không thể xóa phòng ban."); }
});
