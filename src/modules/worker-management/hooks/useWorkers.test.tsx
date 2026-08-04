// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ workerApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
vi.mock("../api/workers.api", () => api);
import { useWorkers } from "./useWorkers";
const worker = { _id: "worker-1", fullName: "Nguyễn Văn A", status: "active" as const };
afterEach(() => vi.clearAllMocks());
describe("useWorkers", () => {
  it("reloads after create, update, and soft-delete mutations", async () => {
    api.workerApi.list.mockResolvedValue([worker]);
    api.workerApi.create.mockResolvedValue(worker);
    api.workerApi.update.mockResolvedValue(worker);
    api.workerApi.delete.mockResolvedValue(worker);
    const { result } = renderHook(() => useWorkers("LABOR"));
    await waitFor(() => expect(api.workerApi.list).toHaveBeenCalledTimes(1));
    await result.current.createWorker({ fullName: "Nguyễn Văn A", status: "active" });
    await result.current.updateWorker("worker-1", { fullName: "Nguyễn Văn B", status: "active" });
    await result.current.deleteWorker("worker-1");
    expect(api.workerApi.list).toHaveBeenCalledTimes(4);
  });
});