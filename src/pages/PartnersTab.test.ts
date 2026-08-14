import { describe, expect, it } from "vitest";
import { isLaborPartnerWorkspace } from "./PartnersTab";
import { APP_ROUTES } from "../router/route-config";

describe("partner workspace selection", () => {
  it("keeps the existing partners workspace for education accounts", () => {
    expect(isLaborPartnerWorkspace("education")).toBe(false);
  });

  it("selects the isolated labor partners workspace for labor accounts", () => {
    expect(isLaborPartnerWorkspace("labor")).toBe(true);
  });

  it("requires the labor partner read permission for a labor tenant", () => {
    const route = APP_ROUTES.find((item) => item.tab === "ĐỐI TÁC");
    expect(route?.canAccess?.({ role: "user", businessType: "labor", permissions: ["labor-partner:read"] } as any)).toBe(true);
    expect(route?.canAccess?.({ role: "user", businessType: "labor", permissions: ["partner:read"] } as any)).toBe(false);
  });
});
