import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:http";

type Account = { _id: string; email: string; role: string; companyCode: string; branchId?: string; sessionId: string };
export async function startQaApi({ directory, accounts }: { directory: string; accounts: Account[] }) {
  const { apiRouter } = await import("../../server/router/index");
  const { userActivityMiddleware, flushUserActivityQueue } = await import("../../server/middleware/user-activity");
  const { apiErrorHandler } = await import("../../server/middleware/api-error-handler");
  const { SuperAdminSessionModel } = await import("../../server/model/super-admin-session.model");
  const { BranchModel } = await import("../../server/model/branch.model");
  const { UserModel } = await import("../../server/model/user.model");
  const app = express();
  app.use(express.json()); app.use(cookieParser());
  app.use("/api/v1", userActivityMiddleware(), apiRouter);
  app.use(apiErrorHandler);
  app.use(express.static("dist"));
  app.get("*", (_req, res) => res.sendFile(path.resolve("dist/index.html")));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(3120, "127.0.0.1", resolve));
  const deviceId = randomUUID();
  const superAdmin = accounts.find((account) => account.role === "superadmin")!;
  await SuperAdminSessionModel.create({ sessionId: superAdmin.sessionId, userId: superAdmin._id, deviceId, expiresAt: new Date(Date.now() + 8 * 3600000) });
  const token = (account: Account) => jwt.sign({ id: account._id, email: account.email, role: account.role, companyCode: account.companyCode, sid: account.sessionId, authLevel: account.role === "superadmin" ? "mfa" : "password" }, process.env.JWT_ACCESS_SECRET!, { expiresIn: "8h" });
  const results: Array<{ name: string; method: string; route: string; status: number; passed: boolean; detail?: string }> = [];
  async function request(name: string, route: string, actor: Account | null, expected = 200, method = "GET", body?: any) {
    console.log(`API smoke: ${name}`);
    const headers: Record<string, string> = { "Content-Type": "application/json", "x-device-id": deviceId };
    if (actor) { headers.Authorization = `Bearer ${token(actor)}`; if (actor.branchId) headers["x-branch-id"] = actor.branchId; }
    let response: Response;
    try { response = await fetch(`http://127.0.0.1:3120/api/v1${route}`, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) }); }
    catch (error) { results.push({ name, method, route, status: 0, passed: false, detail: error instanceof Error ? error.message : String(error) }); return {}; }
    const data = await response.json().catch(() => ({}));
    results.push({ name, method, route, status: response.status, passed: response.status === expected, ...(response.status !== expected ? { detail: data.message || JSON.stringify(data).slice(0, 300) } : {}) });
    return data;
  }
  for (const companyCode of ["QA_EDU", "QA_LABOR"]) {
    const admin = accounts.find((account) => account.role === "admin" && account.companyCode === companyCode)!;
    const branch = accounts.find((account) => account.role === "manager" && account.companyCode === companyCode)!;
    const scopedAdmin = { ...admin, branchId: branch.branchId };
    for (const [name, route] of [
      ["Hồ sơ đăng nhập", "/auth/me"], ["Chi nhánh", "/auth/branches"], ["Nhân sự", "/auth/users"],
      ["Phòng ban", "/hr/departments"], ["Hợp đồng", "/hr-contracts"], ["Chính sách lương", "/payroll/policies"],
      ["Dự án", "/crud/projects"], ["Công việc", "/crud/kanban-tasks"], ["Kho cũ", "/crud/products"],
      ["Danh mục sản phẩm", "/inventory/catalog/products"], ["Kho hàng", "/inventory/warehouses"],
      ["Tài nguyên", "/resources?section=local"], ["Chat", "/chat/rooms"],
      ["Khách hàng", "/customers"], ["Đơn bán lẻ", "/retail/orders"], ["Đối tác bán lẻ", "/retail/partners"],
      ["Sửa chữa", "/repair/tickets"], ["Công nợ", "/finance/receivables"], ["Tài sản", "/finance/assets"],
      ["Marketing", "/marketing/campaigns"],
      ...(companyCode === "QA_EDU" ? [["Học viên", "/students"], ["Khóa học", "/courses"], ["Lớp học", "/batches"]] : [["Lao động", "/worker-management/workers"], ["Dự án lao động", "/worker-management/projects"]]),
    ]) await request(`${companyCode}: ${name}`, route, scopedAdmin);
    await request(`${companyCode}: Admin không được đọc giám sát toàn hệ thống`, "/super-admin/activity/events", admin, 403);
    const otherBranch = accounts.find((account) => account.companyCode !== companyCode && account.branchId)?.branchId;
    await request(`${companyCode}: chặn chi nhánh khác doanh nghiệp`, "/auth/users", { ...admin, branchId: otherBranch }, 403);
    const companyUser = accounts.find((account) => account.companyCode === companyCode && account.role === "user")!;
    await request(`${companyCode}: nhân viên không được tạo chi nhánh`, "/auth/branches", companyUser, 403, "POST", { code: "DENIED", name: "Không được tạo" });
  }
  await request("Chặn người chưa đăng nhập", "/super-admin/activity/events", null, 401);
  const monitored = await request("Super Admin xem hoạt động trên MongoDB thật", "/super-admin/activity/events", superAdmin);
  results.push({ name: "Giám sát trả dữ liệu mẫu và thống kê", method: "ASSERT", route: "/super-admin/activity/events", status: 200, passed: monitored.total >= 240 && monitored.data?.length === 30 && monitored.summary?.companies >= 2 });
  const employee = accounts.find((account) => account.companyCode === "QA_EDU" && account.role === "manager")!;
  const filtered = await request("Lọc theo doanh nghiệp và cá nhân", `/super-admin/activity/events?companyCode=QA_EDU&userId=${employee._id}`, superAdmin);
  results.push({ name: "Không rò nhật ký ngoài bộ lọc", method: "ASSERT", route: "/super-admin/activity/events", status: 200, passed: filtered.data?.length > 0 && filtered.data.every((event: any) => event.companyCode === "QA_EDU" && event.userId === employee._id) });
  const filteredAccounts = await request("Tìm tài khoản trong doanh nghiệp", "/super-admin/activity/accounts?companyCode=QA_EDU", superAdmin);
  results.push({ name: "Không rò tài khoản doanh nghiệp khác", method: "ASSERT", route: "/super-admin/activity/accounts", status: 200, passed: Array.isArray(filteredAccounts) && filteredAccounts.every((account: any) => account.companyCode === "QA_EDU") });
  const qaAdmin = accounts.find((account) => account.companyCode === "QA_EMPTY")!;
  const created = await request("Admin mới tạo chi nhánh", "/auth/branches", qaAdmin, 201, "POST", { code: `QA-${Date.now()}`, name: "Chi nhánh tạo bằng API kiểm thử" });
  if (created.data?._id) {
    await request("Hủy chi nhánh đang chờ chủ chi nhánh", `/auth/branches/${created.data._id}/pending`, qaAdmin, 200, "DELETE");
    results.push({ name: "Hủy chỉ xóa chi nhánh vừa tạo", method: "ASSERT", route: "/auth/branches", status: 200, passed: !await BranchModel.exists({ _id: created.data._id }) });
  }
  const access = JSON.parse(await readFile(path.join(directory, "access.json"), "utf8"));
  const admin = accounts.find((account) => account.companyCode === "QA_EDU" && account.role === "admin")!;
  await request("Đăng nhập với mật khẩu dữ liệu mẫu", "/auth/login", null, 200, "POST", { email: admin.email, password: access.retailDemo.password });
  const paused = accounts.find((account) => account.companyCode === "QA_PAUSED")!;
  await request("Doanh nghiệp bị tạm ngưng không được đăng nhập", "/auth/login", null, 401, "POST", { email: paused.email, password: access.password });
  await flushUserActivityQueue();
  // Keep an ordinary local session consistent after the login smoke test.
  const updated = await UserModel.findById(admin._id).select("activeSessionId").lean();
  if (updated?.activeSessionId) admin.sessionId = updated.activeSessionId;
  const laborAdmin = accounts.find((account) => account.companyCode === "QA_LABOR" && account.role === "admin")!;
  await writeFile(path.join(directory, "browser-auth.json"), JSON.stringify({ deviceId, superAdminToken: token(superAdmin), adminToken: token(admin), laborAdminToken: token(laborAdmin) }));
  return { server, results };
}
