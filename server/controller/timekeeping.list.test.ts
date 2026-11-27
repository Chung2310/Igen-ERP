import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  employees: [{ _id: "employee-1", displayName: "Nguyễn An" }],
  logs: [{ uid: "employee-1", checkIn: { time: "2026-11-25T01:00:00.000Z" } }],
  userFilter: vi.fn(),
  logFilter: vi.fn(),
}));

vi.mock("../model/user.model", () => ({
  UserModel: { find: state.userFilter },
}));
vi.mock("../model/timekeeping.model", () => ({
  TimekeepingLogModel: { find: state.logFilter },
}));
vi.mock("../utils/attendance-report", () => ({
  buildAttendanceReportRows: (date: string, employees: any[], logs: any[]) => ({ date, employeeCount: employees.length, logCount: logs.length }),
}));

import { timekeepingController } from "./timekeeping.controller";

function query(value: unknown) {
  const chain: any = {
    select: () => chain,
    sort: () => chain,
    lean: async () => value,
  };
  return chain;
}

function response() {
  const res: any = { status: vi.fn(), json: vi.fn() };
  res.status.mockImplementation(() => res);
  return res;
}

afterEach(() => vi.clearAllMocks());

it("uses the company roster only for an admin who explicitly requests company scope", async () => {
  state.userFilter.mockImplementation(() => query(state.employees));
  state.logFilter.mockImplementation(() => query(state.logs));
  const res = response();

  await timekeepingController.listAttendanceRecords({
    user: { companyCode: "ACME", branchId: "branch-1", role: "admin" },
    query: { date: "2026-11-25", scope: "company" },
  } as any, res);

  expect(state.userFilter).toHaveBeenCalledWith({ companyCode: "ACME" });
  expect(state.logFilter).toHaveBeenCalledWith({ companyCode: "ACME", date: "2026-11-25", uid: { $in: ["employee-1"] } });
  expect(res.json).toHaveBeenCalledWith({ status: "success", data: { date: "2026-11-25", employeeCount: 1, logCount: 1 } });
});

it("keeps a branch user's data scoped when requesting the company roster", async () => {
  const res = response();

  await timekeepingController.listAttendanceRecords({
    user: { companyCode: "ACME", branchId: "branch-1", role: "manager" },
    query: { date: "2026-11-25", scope: "company" },
  } as any, res);

  expect(res.status).toHaveBeenCalledWith(403);
  expect(state.userFilter).not.toHaveBeenCalled();
});

it("keeps the default report scoped to the signed-in branch", async () => {
  state.userFilter.mockImplementation(() => query(state.employees));
  state.logFilter.mockImplementation(() => query(state.logs));
  const res = response();

  await timekeepingController.listAttendanceRecords({
    user: { companyCode: "ACME", branchId: "branch-1", role: "manager" },
    query: { date: "2026-11-25" },
  } as any, res);

  expect(state.userFilter).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "branch-1" });
  expect(state.logFilter).toHaveBeenCalledWith({ companyCode: "ACME", date: "2026-11-25", uid: { $in: ["employee-1"] }, branchId: "branch-1" });
});
