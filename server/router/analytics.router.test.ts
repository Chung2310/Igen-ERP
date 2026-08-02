import assert from "node:assert/strict";
import test from "node:test";
import { analyticsRouter } from "./analytics.router";

/**
 * Lấy các middleware gắn ở cấp router (`.use`) — tức áp cho MỌI endpoint bên trong,
 * phân biệt với middleware chỉ gắn cho một route cụ thể (`layer.route` khác undefined).
 */
function routerLevelMiddleware(router: any): any[] {
  return router.stack.filter((layer: any) => !layer.route).map((layer: any) => layer.handle);
}

/** Chạy middleware với một vai trò giả lập, trả về kết quả chặn hay cho qua */
function runGate(middleware: any, role: string | undefined) {
  const result: { status?: number; body?: any; passed: boolean } = { passed: false };

  const req: any = role ? { user: { id: "u1", role, companyCode: "C1" } } : {};
  const res: any = {
    status(code: number) {
      result.status = code;
      return res;
    },
    json(body: any) {
      result.body = body;
      return res;
    },
  };

  middleware(req, res, () => {
    result.passed = true;
  });

  return result;
}

test("analytics router gắn gate ở cấp router nên mọi endpoint đều được bảo vệ", () => {
  const middleware = routerLevelMiddleware(analyticsRouter);

  // requireAuth + requireRole — đặt ở cấp router để endpoint thêm về sau không thể
  // vô tình bị bỏ sót gate.
  assert.equal(
    middleware.length,
    2,
    "analyticsRouter phải có đúng requireAuth và requireRole ở cấp router"
  );

  const routes = analyticsRouter.stack.filter((layer: any) => layer.route);
  assert.ok(routes.length > 0, "phải có ít nhất một endpoint được đăng ký");
});

test("đăng ký đủ endpoint doanh thu, công nợ, chi phí và P&L", () => {
  const paths = analyticsRouter.stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => layer.route.path);
  for (const path of ["/meta", "/revenue", "/receivables", "/expenses", "/pnl", "/export"]) {
    assert.ok(paths.includes(path), `thiếu endpoint analytics ${path}`);
  }
});

test("chỉ admin và superadmin đi qua được gate của khu vực phân tích", () => {
  const roleGate = routerLevelMiddleware(analyticsRouter)[1];

  for (const role of ["admin", "superadmin"]) {
    const result = runGate(roleGate, role);
    assert.equal(result.passed, true, `${role} phải được truy cập báo cáo`);
  }
});

test("branch_owner bị chặn khỏi khu vực phân tích (dùng trang tổng quan chung)", () => {
  const roleGate = routerLevelMiddleware(analyticsRouter)[1];

  const result = runGate(roleGate, "branch_owner");

  assert.equal(result.passed, false);
  assert.equal(result.status, 403);
});

test("các vai trò còn lại và request chưa xác thực đều bị chặn 403", () => {
  const roleGate = routerLevelMiddleware(analyticsRouter)[1];

  for (const role of ["user", "manager"]) {
    const result = runGate(roleGate, role);
    assert.equal(result.passed, false, `${role} không được xem báo cáo doanh thu`);
    assert.equal(result.status, 403);
  }

  const anonymous = runGate(roleGate, undefined);
  assert.equal(anonymous.passed, false);
  assert.equal(anonymous.status, 403);
});
