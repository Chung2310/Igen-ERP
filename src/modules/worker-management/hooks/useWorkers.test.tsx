// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ workerApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock("../api/workers.api", () => api);
import { useWorkers } from "./useWorkers";
const worker = { _id: "worker-1", fullName: "Nguyễn Văn A", status: "active" as const };
afterEach(() => vi.clearAllMocks());
describe("useWorkers", () => {
  it("propagates tenant and branch scope through list and every mutation", async () => {
    api.workerApi.list.mockResolvedValue([worker]);
    api.workerApi.create.mockResolvedValue(worker);
    api.workerApi.update.mockResolvedValue(worker);
    api.workerApi.delete.mockResolvedValue(worker);
    const scope = { companyCode: "LABOR", branchId: "branch-1" };
    const { result } = renderHook(() => useWorkers(scope));
    await waitFor(() => expect(api.workerApi.list).toHaveBeenCalledWith(scope));
    await result.current.createWorker({ fullName: "Nguyễn Văn A", status: "active" });
    await result.current.updateWorker("worker-1", { fullName: "Nguyễn Văn B", status: "active" });
    await result.current.deleteWorker("worker-1");
    expect(api.workerApi.list).toHaveBeenCalledTimes(4);
    expect(api.workerApi.create).toHaveBeenCalledWith(
      { fullName: "Nguyễn Văn A", status: "active" },
      scope,
    );
    expect(api.workerApi.update).toHaveBeenCalledWith(
      "worker-1",
      { fullName: "Nguyễn Văn B", status: "active" },
      scope,
    );
    expect(api.workerApi.delete).toHaveBeenCalledWith("worker-1", scope);
  });
});