import { expect, it } from "vitest";
import type { UserProfile } from "../types";
import { getRouteByTab } from "./route-config";
import { pathToTab, tabToPath } from "../seo/seo-config";

it("registers the standalone assistant page behind chat read permission", () => {
  const route = getRouteByTab("TRỢ LÝ AI");
  expect(route.tab).toBe("TRỢ LÝ AI");
  expect(route.canAccess?.({ permissions: ["chat:read"] } as UserProfile)).toBe(true);
  expect(route.canAccess?.({ permissions: ["inventory:read"] } as UserProfile)).toBe(false);
  expect(tabToPath("TRỢ LÝ AI")).toBe("/tro-ly-ai");
  expect(pathToTab("/tro-ly-ai")).toBe("TRỢ LÝ AI");
});
