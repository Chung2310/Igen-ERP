import { describe, expect, it } from "vitest";
import { APP_ROUTES } from "../router/route-config";

describe("partner routes", () => {
  it("keeps student and worker partner access separate", () => {
    const student = APP_ROUTES.find((route) => route.tab === "ĐỐI TÁC");
    const worker = APP_ROUTES.find((route) => route.tab === "ĐỐI TÁC LAO ĐỘNG");
    const user = { role: "user", permissions: ["labor-partner:read"] } as any;
    expect(student?.canAccess?.(user)).toBe(false);
    expect(worker?.canAccess?.(user)).toBe(true);
    user.permissions = ["relationship:read"];
    expect(student?.canAccess?.(user)).toBe(true);
    expect(worker?.canAccess?.(user)).toBe(false);
  });
});
