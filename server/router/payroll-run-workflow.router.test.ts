import { describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => new Map<any, string | string[]>());

vi.mock("../middleware/auth", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    requirePermission: (permission: string | string[]) => {
      const guard = (_req: any, _res: any, next: any) => next();
      guards.set(guard, permission);
      return guard;
    },
  };
});

import { payrollRouter } from "./payroll.router";

const permissionOf = (method: string, path: string) => {
  const layer = (payrollRouter as any).stack.find((item: any) => (
    item.route?.path === path && item.route?.methods?.[method.toLowerCase()]
  ));
  if (!layer) return undefined;
  return layer.route.stack
    .map((handler: any) => guards.get(handler.handle))
    .find((permission: string | undefined) => permission !== undefined);
};

describe("payroll workflow route guards", () => {
  it.each([
    ["POST", "/runs/:id/review"],
    ["POST", "/runs/:id/close"],
    ["POST", "/runs/:id/reopen"],
    ["POST", "/runs/:id/calculate"],
    ["POST", "/runs/:id/recalculate"],
  ])("guards %s %s with payroll:manage", (method, path) => {
    expect(permissionOf(method, path)).toBe("payroll:manage");
  });

  it.each([
    ["POST", "/runs/:id/payments"],
    ["POST", "/payments/:id/confirm"],
    ["POST", "/payments/:id/cancel"],
    ["POST", "/payments/:id/reverse"],
  ])("guards %s %s with payroll:pay", (method, path) => {
    expect(permissionOf(method, path)).toBe("payroll:pay");
  });

  it.each([
    ["POST", "/policies"],
    ["POST", "/policies/:id/activate"],
    ["POST", "/policies/:id/retire"],
  ])("guards %s %s with payroll:manage", (method, path) => {
    expect(permissionOf(method, path)).toBe("payroll:manage");
  });

  it.each([
    ["GET", "/runs/:id/audit"],
    ["GET", "/runs/:id/payments"],
    ["GET", "/policies"],
  ])("lets payroll readers call %s %s", (method, path) => {
    expect(permissionOf(method, path)).toBe("payroll:read");
  });

  it("never exposes a workflow route without a permission guard", () => {
    const unguarded = (payrollRouter as any).stack
      .filter((item: any) => item.route?.path?.startsWith("/runs") || item.route?.path?.startsWith("/payments"))
      .filter((item: any) => !item.route.stack.some((handler: any) => guards.has(handler.handle)))
      .map((item: any) => item.route.path);

    expect(unguarded).toEqual([]);
  });
});
