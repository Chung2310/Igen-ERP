import { describe, expect, it } from "vitest";
import { RetailPartnerModel } from "../models/retail-partner.model";
import { normalizeRetailPartnerInput, retailPartnerRoutes } from "./retail-partner.routes";

describe("Đối tác bán lẻ", () => {
  it("chuẩn hóa hồ sơ nhiều vai trò và mã trong phạm vi công ty", () => {
    expect(normalizeRetailPartnerInput({ code: " ctv_01 ", name: " Cộng tác viên A ", roles: ["collaborator", "dealer", "collaborator"] })).toMatchObject({
      code: "CTV_01", name: "Cộng tác viên A", roles: ["collaborator", "dealer"], status: "active",
    });
  });

  it("chặn vai trò, trạng thái và mã không hợp lệ", () => {
    expect(() => normalizeRetailPartnerInput({ code: "", name: "A", roles: ["collaborator"] })).toThrow();
    expect(() => normalizeRetailPartnerInput({ code: "CTV-1", name: "A", roles: ["other"] })).toThrow();
    expect(() => normalizeRetailPartnerInput({ code: "CTV-1", name: "A", roles: ["collaborator"], status: "deleted" })).toThrow();
  });

  it("giữ chỉ mục duy nhất cho mã, tài khoản và nhà cung cấp theo công ty", () => {
    const indexes = RetailPartnerModel.schema.indexes();
    for (const field of ["code", "userId", "supplierId"]) {
      expect(indexes.some(([keys, options]) => keys.companyCode === 1 && keys[field] === 1 && options.unique)).toBe(true);
    }
  });

  it("có API chọn CTV, tự xem và quản lý hồ sơ tách biệt", () => {
    const paths = retailPartnerRoutes.stack.flatMap((layer: any) => layer.route ? [layer.route.path] : []);
    expect(paths).toEqual(expect.arrayContaining(["/collaborators", "/me", "/", "/:id"]));
  });
});
