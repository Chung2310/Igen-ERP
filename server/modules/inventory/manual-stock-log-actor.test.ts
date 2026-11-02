import { expect, it, vi } from "vitest";
vi.mock("./manual-stock-log.service", () => ({ createManualStockLog: vi.fn(), updateManualStockLog: vi.fn(), deleteManualStockLog: vi.fn() }));
import { createManualStockLog, updateManualStockLog } from "./manual-stock-log.service";
import { crudService } from "../../service/crud.service";

it("forwards authenticated actor separately from client payload on create and completion", async () => {
  const actor = { id: "real-user", name: "Real User" };
  const input = { operatorName: "Client label", createdById: "forged", status: "Hoàn thành" };
  vi.mocked(createManualStockLog).mockResolvedValue({ _id: "log" } as never);
  vi.mocked(updateManualStockLog).mockResolvedValue({ _id: "log" } as never);
  await crudService.create("stock-logs", input, "COMPANY", "branch", actor);
  expect(createManualStockLog).toHaveBeenCalledWith({ companyCode: "COMPANY", branchId: "branch" }, input, actor);
  await crudService.update("stock-logs", "log", input, "COMPANY", "admin", "branch", actor);
  expect(updateManualStockLog).toHaveBeenCalledWith({ companyCode: "COMPANY", branchId: "branch" }, "log", input, actor);
});
