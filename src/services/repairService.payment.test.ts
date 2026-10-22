// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { repairService } from "./repairService";
import { apiFetch } from "../modules/shared/lib/apiFetch";

vi.mock("../modules/shared/lib/apiFetch", () => ({ apiFetch: vi.fn() }));
const fetchMock = vi.mocked(apiFetch);

describe("gửi lại thanh toán sửa chữa", () => {
  beforeEach(() => { sessionStorage.clear(); fetchMock.mockReset(); vi.stubGlobal("crypto", { randomUUID: () => "attempt-key" }); });
  it("checks a committed receipt before retrying after a network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Mất mạng"));
    await expect(repairService.pay("ticket-1", 100_000)).rejects.toThrow("Mất mạng");
    fetchMock.mockResolvedValueOnce({ data: { idempotencyKey: "attempt-key" } } as any);
    fetchMock.mockResolvedValueOnce({ data: { _id: "ticket-1", paidAmount: 100_000 } } as any);
    const ticket = await repairService.pay("ticket-1", 100_000);
    expect(ticket.paidAmount).toBe(100_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([path, options]) => path === "/repair/tickets/ticket-1/payments" && options?.method === "POST")).toHaveLength(1);
  });
  it("blocks a different amount while the earlier attempt is unresolved", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Mất mạng"));
    await expect(repairService.pay("ticket-1", 100_000)).rejects.toThrow();
    fetchMock.mockResolvedValueOnce({ data: null } as any);
    await expect(repairService.pay("ticket-1", 50_000)).rejects.toThrow(/chưa rõ kết quả/);
  });
});
