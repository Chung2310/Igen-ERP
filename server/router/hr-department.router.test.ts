import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HrDepartmentModel } from "../model/hr-department.model";
import { SuperAdminSessionModel } from "../model/super-admin-session.model";
import { UserModel } from "../model/user.model";
import { hrDepartmentRouter } from "./hr-department.router";

describe("HR department API", () => {
  let replSet: MongoMemoryReplSet;
  let server: ReturnType<ReturnType<typeof express>["listen"]>;
  let baseUrl: string;
  let token: string;

  const request = async (method: string, path: string, body?: object) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "hr-department-test-secret";
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    const app = express();
    app.use(express.json());
    app.use("/hr/departments", hrDepartmentRouter);
    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not start");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    await Promise.all([HrDepartmentModel.deleteMany({}), SuperAdminSessionModel.deleteMany({}), UserModel.deleteMany({})]);
    const admin = await UserModel.create({ email: "admin@example.test", displayName: "Admin", role: "superadmin", companyCode: "SYSTEM" });
    const sessionId = `hr-department-${new mongoose.Types.ObjectId()}`;
    await SuperAdminSessionModel.create({ sessionId, userId: admin._id, deviceId: "hr-department-test", expiresAt: new Date(Date.now() + 60 * 60_000) });
    token = jwt.sign({ id: String(admin._id), email: admin.email, role: "superadmin", companyCode: "SYSTEM", sid: sessionId }, process.env.JWT_ACCESS_SECRET!);
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server?.close(() => resolve()));
    await mongoose.disconnect();
    await replSet?.stop();
  });

  it("imports, renames, and deletes departments within the selected company", async () => {
    const employeeA = await UserModel.create({ email: "a@example.test", displayName: "A", companyCode: "A", department: "  Kinh  doanh  " });
    const employeeB = await UserModel.create({ email: "b@example.test", displayName: "B", companyCode: "B", department: "Kinh doanh" });
    const listed = await request("GET", "/hr/departments?companyCode=A");
    expect(listed.status).toBe(200);
    expect(listed.body.data).toMatchObject([{ name: "Kinh doanh", employeeCount: 1 }]);

    const id = listed.body.data[0].id;
    const renamed = await request("PATCH", `/hr/departments/${id}?companyCode=A`, { companyCode: "A", name: "Bán hàng" });
    expect(renamed.status).toBe(200);
    expect((await UserModel.findById(employeeA._id))?.department).toBe("Bán hàng");
    expect((await UserModel.findById(employeeB._id))?.department).toBe("Kinh doanh");
    const deleted = await request("DELETE", `/hr/departments/${id}?companyCode=A`);
    expect(deleted.status).toBe(200);
    expect((await UserModel.findById(employeeA._id))?.department).toBe("");
    expect((await UserModel.findById(employeeB._id))?.department).toBe("Kinh doanh");
    expect(await HrDepartmentModel.findById(id)).toBeNull();
    expect((await request("PATCH", `/hr/departments/${id}?companyCode=B`, { companyCode: "B", name: "Sai công ty" })).status).toBe(404);
  });

  it("creates an empty department, rejects duplicates, and allows deletion", async () => {
    const created = await request("POST", "/hr/departments", { companyCode: "A", name: "Nhân sự" });
    expect(created.status).toBe(201);
    expect((await request("POST", "/hr/departments", { companyCode: "A", name: "  NHÂN SỰ  " })).status).toBe(409);
    expect((await request("DELETE", `/hr/departments/${created.body.data.id}?companyCode=A`)).status).toBe(200);
    expect(await HrDepartmentModel.countDocuments({ companyCode: "A" })).toBe(0);
  });

  it("stores department metadata and rejects duplicate codes or managers from another company", async () => {
    const manager = await UserModel.create({ email: "lead@example.test", displayName: "Trưởng phòng", companyCode: "A" });
    const outsider = await UserModel.create({ email: "other@example.test", displayName: "Người ngoài", companyCode: "B" });
    const created = await request("POST", "/hr/departments", { companyCode: "A", name: "Kinh doanh", code: "KD", description: "Bán hàng", managerUid: String(manager._id), sortOrder: 2, isActive: true });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ code: "KD", description: "Bán hàng", managerName: "Trưởng phòng", sortOrder: 2, isActive: true });
    const legacyRename = await request("PATCH", `/hr/departments/${created.body.data.id}?companyCode=A`, { companyCode: "A", name: "Kinh doanh mới" });
    expect(legacyRename.status).toBe(200);
    expect(legacyRename.body.data).toMatchObject({ code: "KD", description: "Bán hàng", managerName: "Trưởng phòng", sortOrder: 2, isActive: true });
    expect((await request("POST", "/hr/departments", { companyCode: "A", name: "Khác", code: "KD" })).status).toBe(409);
    expect((await request("POST", "/hr/departments", { companyCode: "A", name: "Sai quản lý", managerUid: String(outsider._id) })).status).toBe(400);
    const changed = await request("PATCH", `/hr/departments/${created.body.data.id}?companyCode=A`, { companyCode: "A", name: "Kinh doanh", code: "SALES", description: "Kinh doanh bán lẻ", managerUid: "", sortOrder: 1, isActive: false });
    expect(changed.status).toBe(200);
    expect(changed.body.data).toMatchObject({ code: "SALES", sortOrder: 1, isActive: false });
    expect(changed.body.data.managerUid).toBeUndefined();
  });
});
