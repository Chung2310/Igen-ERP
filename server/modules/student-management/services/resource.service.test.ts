import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ countDocuments: vi.fn(), find: vi.fn(), query: undefined as any }));
vi.mock("../models/resource.model", () => ({
  Resource: {
    countDocuments: state.countDocuments,
    find: state.find,
  },
}));

import { ResourceService } from "./resource.service";

beforeEach(() => {
  state.query = undefined;
  state.countDocuments.mockReset().mockImplementation(async (query: unknown) => { state.query = query; return 1; });
  const chain = {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ name: "Máy chiếu Epson", type: "Máy chiếu" }]),
  };
  state.find.mockReset().mockImplementation((query: unknown) => { state.query = query; return chain; });
});

it("excludes classrooms when the equipment tab is requested", async () => {
  const result = await ResourceService.getResources("owner", { excludeType: "Phòng học" }, "branch");

  expect(state.query).toMatchObject({ ownerId: "owner", branchId: "branch", type: { $ne: "Phòng học" } });
  expect(result.resources).toEqual([{ name: "Máy chiếu Epson", type: "Máy chiếu" }]);
});
