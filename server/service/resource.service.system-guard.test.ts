import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourceItemModel } from "../model/resource-item.model";
import { resourceService } from "./resource.service";

afterEach(() => vi.restoreAllMocks());

describe("resourceService system-managed guards", () => {
  it("blocks share management even for an admin", async () => {
    vi.spyOn(ResourceItemModel, "findOne").mockReturnValue({
      lean: async () => ({
        _id: "507f1f77bcf86cd799439011",
        companyCode: "ACME",
        managedType: "system",
        creatorUid: "system",
        shares: [],
      }),
    } as any);

    await expect(resourceService.getShares(
      "ACME",
      "507f1f77bcf86cd799439011",
      "admin-1",
      "admin",
    )).rejects.toThrow("Tài nguyên hệ thống chỉ được thay đổi tại chức năng nguồn.");
  });
});
