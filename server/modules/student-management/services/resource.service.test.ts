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

it('returns a structured room name for scoped calendar bookings instead of requiring searches in descriptive text',async()=>{
 state.find.mockResolvedValueOnce([{_id:'room',name:'QA P02',identifier:'QA-P02',bookings:[{_id:'slot1',date:'2026-11-27',startTime:'08:00',endTime:'10:00',by:'QA Giảng viên',purpose:'Lớp QA'},{_id:'slot2',date:'2026-11-28',startTime:'08:00',endTime:'10:00',by:'QA Giảng viên',purpose:'Lớp QA'}]}]);
 const events=await ResourceService.getBookingsInRange('owner','2026-11-27','2026-11-27','branch');
 expect(state.find).toHaveBeenLastCalledWith({ownerId:'owner',branchId:'branch'});
 expect(events).toHaveLength(1);expect(events[0]).toMatchObject({date:'2026-11-27',location:'QA P02',details:'Lớp QA • QA-P02'});
});
