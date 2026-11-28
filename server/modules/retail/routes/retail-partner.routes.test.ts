import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RolePermissionModel } from "../../../model/role-permission.model";
import { RetailPartnerModel } from "../models/retail-partner.model";
import { SupplierModel } from "../../../model/supplier.model";
import { UserModel } from "../../../model/user.model";
import { normalizeRetailPartnerInput, retailPartnerRoutes } from "./retail-partner.routes";

describe("Đối tác bán lẻ", () => {
  beforeEach(() => {
    vi.spyOn(UserModel, "findById").mockReturnValue({ select: () => ({ lean: async () => ({ permissions: [] }) }) } as any);
    vi.spyOn(RolePermissionModel, "findOne").mockReturnValue({ lean: async () => null } as any);
  });
  afterEach(() => vi.restoreAllMocks());

  it("chuẩn hóa hồ sơ một vai trò và mã trong phạm vi công ty", () => {
    expect(normalizeRetailPartnerInput({ code: " ctv_01 ", name: " Cộng tác viên A ", roles: ["collaborator"] })).toMatchObject({
      code: "CTV_01", name: "Cộng tác viên A", roles: ["collaborator"], status: "active",
    });
  });

  it("chặn nhiều vai trò, vai trò, trạng thái và mã không hợp lệ", () => {
    expect(() => normalizeRetailPartnerInput({ code: "", name: "A", roles: ["collaborator"] })).toThrow();
    expect(() => normalizeRetailPartnerInput({ code: "CTV-1", name: "A", roles: ["other"] })).toThrow();
    expect(() => normalizeRetailPartnerInput({ code: "CTV-1", name: "A", roles: ["collaborator", "dealer"] })).toThrow();
    expect(() => normalizeRetailPartnerInput({ code: "CTV-1", name: "A", roles: ["dealer"], userId: "507f1f77bcf86cd799439011" })).toThrow();
    expect(() => normalizeRetailPartnerInput({ code: "CTV-1", name: "A", roles: ["collaborator"], customerId: "507f1f77bcf86cd799439011" })).toThrow();
    expect(() => normalizeRetailPartnerInput({ code: "CTV-1", name: "A", roles: ["collaborator"], status: "deleted" })).toThrow();
  });

  it("giữ chỉ mục duy nhất cho mã, tài khoản và nhà cung cấp theo công ty", () => {
    const indexes = RetailPartnerModel.schema.indexes();
    for (const field of ["code", "userId", "supplierId", "customerId"]) {
      expect(indexes.some(([keys, options]) => keys.companyCode === 1 && keys[field] === 1 && options.unique)).toBe(true);
    }
  });

  it("có API chọn CTV, tự xem và quản lý hồ sơ tách biệt", () => {
    const paths = retailPartnerRoutes.stack.flatMap((layer: any) => layer.route ? [layer.route.path] : []);
    expect(paths).toEqual(expect.arrayContaining(["/collaborators", "/customers", "/me", "/assistant-overview", "/", "/:id"]));
  });

  it("filters assistant partner lookups by inactive status and missing contact fields", async () => {
    const query: any = { sort: vi.fn(() => query), limit: vi.fn(() => query), lean: vi.fn().mockResolvedValue([]) };
    const supplierQuery: any = { select: vi.fn(() => supplierQuery), lean: vi.fn().mockResolvedValue([]) };
    const partnerFind = vi.spyOn(RetailPartnerModel, "find").mockReturnValue(query);
    vi.spyOn(SupplierModel, "find").mockReturnValue(supplierQuery);
    const route: any = retailPartnerRoutes.stack.find((layer: any) => layer.route?.path === "/" && layer.route.methods.get);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await route.route.stack.at(-1).handle({ user: { companyCode: "ACME" }, query: { status: "inactive", missingContact: "true" } }, res);
    expect(partnerFind).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME", status: "inactive",
      $and: [expect.objectContaining({ $or: expect.arrayContaining([
        { phone: { $exists: false } }, { email: null }, { address: "" },
      ]) })],
    }));
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  it("returns company counts for partner role, status and missing contact overview", async () => {
    vi.spyOn(RetailPartnerModel, "countDocuments").mockResolvedValueOnce(12 as any)
      .mockResolvedValueOnce(7 as any).mockResolvedValueOnce(2 as any).mockResolvedValueOnce(3 as any)
      .mockResolvedValueOnce(10 as any).mockResolvedValueOnce(2 as any).mockResolvedValueOnce(1 as any)
      .mockResolvedValueOnce(4 as any).mockResolvedValueOnce(5 as any);
    const route: any = retailPartnerRoutes.stack.find((layer: any) => layer.route?.path === "/assistant-overview" && layer.route.methods.get);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await route.route.stack.at(-1).handle({ user: { companyCode: "ACME" }, query: {} }, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: {
      total: 12, collaborators: 7, dealers: 2, suppliers: 3, active: 10, inactive: 2,
      missingPhone: 1, missingEmail: 4, missingAddress: 5,
    } });
  });

  it("cho phép thu ngân POS tải danh sách CTV bằng quyền mặc định pos:manage", async () => {
    const route: any = retailPartnerRoutes.stack.find((layer: any) => layer.route?.path === "/collaborators" && layer.route.methods.get);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await route.route.stack[0].handle({ user: { id: "cashier-1", role: "pos_cashier", companyCode: "ACME" } }, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
