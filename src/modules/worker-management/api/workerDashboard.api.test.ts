import { describe, expect, it, vi } from "vitest";
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("./client", () => ({ workerApiFetch: fetchMock }));
import { workerDashboardApi } from "./workerDashboard.api";
describe("workerDashboardApi", () => { it("loads worker dashboard from worker namespace", async () => { fetchMock.mockResolvedValue({ data: { totalWorkers: 2, activeWorkers: 1, projects: 1 } }); await workerDashboardApi.get("ACME", "BR-1"); expect(fetchMock).toHaveBeenCalledWith("/worker-management/dashboard", expect.objectContaining({ params: { companyCode: "ACME", branchId: "BR-1" } })); }); });
