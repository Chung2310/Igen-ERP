import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ scheduleUpdate: vi.fn(), runFind: vi.fn(), runUpdate: vi.fn(), recordFind: vi.fn(), recordsFind: vi.fn(), recordUpdate: vi.fn(), audit: vi.fn(), load: vi.fn(), transaction: vi.fn() }));
vi.mock("../model/payroll-publication-schedule.model", () => ({ PayrollPublicationScheduleModel: { findOneAndUpdate: mocks.scheduleUpdate } }));
vi.mock("../model/payroll-run.model", () => ({ PayrollRunModel: { findOne: mocks.runFind, findOneAndUpdate: mocks.runUpdate } }));
vi.mock("../model/payroll-reconciliation.model", () => ({ PayrollReconciliationModel: { findOne: mocks.recordFind, find: mocks.recordsFind, findOneAndUpdate: mocks.recordUpdate } }));
vi.mock("../model/payroll-audit.model", () => ({ PayrollAuditModel: { create: mocks.audit } }));
vi.mock("./payroll-effective-line.service", () => ({ loadAuthoritativePayrollLines: mocks.load }));
vi.mock("./payroll-transaction.service", () => ({ runPayrollAtomicTransaction: mocks.transaction }));
import { actMyPayrollReconciliation, actPayrollReconciliation, assertPayrollReconciliationReady, publishPayrollReconciliation } from "./payroll-reconciliation.service";
import { publishReconciliation } from "./payroll-reconciliation-state";
const scope = { companyCode: "ACME", branchId: "branch" };
const session = { id: "tx" };
const run = { _id: "run", ...scope, status: "draft", version: 5, periodKey: "2026-09", reconciliationRequired: true };
const line = { employeeId: "e1", effectiveValues: { adjustedBase: 1000 }, net: 1000 };
const record = () => publishReconciliation(undefined, { runId: "run", employeeId: "e1", employeeName: "An", periodKey: "2026-09" }, line, "staff");
const query = (value: any) => { const q: any = { lean: vi.fn(async () => value) }; q.session = vi.fn(() => q); q.select = vi.fn(() => q); return q; };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(operation => operation(session));
  mocks.runFind.mockReturnValue(query(run));
  mocks.runUpdate.mockResolvedValue({ ...run, version: 6 });
  mocks.recordFind.mockReturnValue(query(record()));
  mocks.recordUpdate.mockResolvedValue({});
  mocks.recordsFind.mockReturnValue(query([record()]));
  mocks.load.mockResolvedValue({ effectiveLines: [line] });
  mocks.audit.mockResolvedValue([]);
});
describe("payroll reconciliation persistence", () => {
  it("automatically publishes only once and locks the saved schedule in the publication transaction", async () => {
    const scheduled = { version: 2, now: new Date("2026-09-20T03:00:00Z") };
    mocks.scheduleUpdate.mockResolvedValue({ enabled: true, day: 20, hour: 9, minute: 0, periodOffset: 0, effectiveFrom: "2026-09-01T00:00:00Z" });
    mocks.runFind.mockReturnValue(query({ ...run, reconciliationRequired: false }));
    mocks.recordFind.mockReturnValue(query(null));
    await publishPayrollReconciliation(scope, "run", "system:payroll-publication", 5, scheduled);
    expect(mocks.scheduleUpdate).toHaveBeenCalledWith({ ...scope, enabled: true, version: 2 }, expect.anything(), expect.objectContaining({ session }));
    expect(mocks.recordUpdate).toHaveBeenCalledOnce();
    mocks.runFind.mockReturnValue(query({ ...run, version: 6 }));
    expect(await publishPayrollReconciliation(scope, "run", "system:payroll-publication", 5, scheduled)).toEqual({ skipped: true, employeeCount: 0 });
    expect(mocks.recordUpdate).toHaveBeenCalledOnce();
  });
  it("skips a schedule disabled/edited after the scan and refuses stale payroll inputs", async () => {
    const scheduled = { version: 2, now: new Date("2026-09-20T03:00:00Z") };
    mocks.scheduleUpdate.mockResolvedValue(null);
    expect(await publishPayrollReconciliation(scope, "run", "system", 5, scheduled)).toEqual({ skipped: true, employeeCount: 0 });
    expect(mocks.runUpdate).not.toHaveBeenCalled();
    mocks.scheduleUpdate.mockResolvedValue({ enabled: true, day: 20, hour: 9, minute: 0, periodOffset: 0, effectiveFrom: "2026-09-01T00:00:00Z" });
    mocks.runFind.mockReturnValue(query({ ...run, reconciliationRequired: false, needsInputRefresh: true }));
    await expect(publishPayrollReconciliation(scope, "run", "system", 5, scheduled)).rejects.toThrow("cập nhật dữ liệu");
    expect(mocks.recordUpdate).not.toHaveBeenCalled();
  });
  it("publishes only authoritative employee values and writes the run, publication and audit in one transaction", async () => {
    mocks.recordFind.mockReturnValue(query(null));
    await publishPayrollReconciliation(scope, "run", "staff", 5);
    expect(mocks.runUpdate).toHaveBeenCalledWith(expect.objectContaining({ ...scope, status: "draft", version: 5 }), expect.objectContaining({ $inc: { version: 1 } }), expect.objectContaining({ session }));
    expect(mocks.recordUpdate).toHaveBeenCalledWith(expect.objectContaining({ ...scope, runId: "run", employeeId: "e1" }), expect.objectContaining({ $set: expect.objectContaining({ snapshot: expect.objectContaining({ values: expect.objectContaining({ net: 1000 }) }) }) }), expect.objectContaining({ session, upsert: true }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.any(Array), { session });
  });
  it("rejects publishing a stale run version without writing", async () => {
    await expect(publishPayrollReconciliation(scope, "run", "staff", 4)).rejects.toThrow("vừa thay đổi");
    expect(mocks.runUpdate).not.toHaveBeenCalled();
    expect(mocks.recordUpdate).not.toHaveBeenCalled();
  });
  it("rejects manual publication when payroll inputs need refresh or contain blocking issues", async () => {
    for (const invalid of [{ needsInputRefresh: true }, { issues: [{ severity: "blocking" }] }]) {
      mocks.runFind.mockReturnValue(query({ ...run, ...invalid }));
      await expect(publishPayrollReconciliation(scope, "run", "staff", 5)).rejects.toThrow();
    }
    expect(mocks.runUpdate).not.toHaveBeenCalled();
    expect(mocks.recordUpdate).not.toHaveBeenCalled();
  });
  it("serializes employee feedback against simultaneous payroll edits/finalization", async () => {
    mocks.runUpdate.mockResolvedValue(null);
    await expect(actPayrollReconciliation(scope, "run", "e1", { id: "e1", name: "An", role: "employee" }, 1, { action: "confirm" })).rejects.toThrow("vừa thay đổi");
    expect(mocks.recordUpdate).not.toHaveBeenCalled();
  });
  it("rejects stale employee acknowledgements and stale document versions", async () => {
    mocks.load.mockResolvedValue({ effectiveLines: [{ ...line, net: 2000 }] });
    await expect(actPayrollReconciliation(scope, "run", "e1", { id: "e1", name: "An", role: "employee" }, 1, { action: "confirm" })).rejects.toThrow("bản mới");
    await expect(actPayrollReconciliation(scope, "run", "e1", { id: "e1", name: "An", role: "employee" }, 0, { action: "confirm" })).rejects.toThrow("vừa thay đổi");
    expect(mocks.recordUpdate).not.toHaveBeenCalled();
  });
  it("prevents access to another employee and to an unpublished run", async () => {
    await expect(actPayrollReconciliation(scope, "run", "victim", { id: "e1", name: "An", role: "employee" }, 1, { action: "confirm" })).rejects.toMatchObject({ status: 403 });
    mocks.recordFind.mockReturnValue(query(null));
    await expect(actMyPayrollReconciliation("ACME", "e1", "unpublished", "An", 1, { action: "confirm" })).rejects.toMatchObject({ status: 404 });
    expect(mocks.recordFind).toHaveBeenLastCalledWith({ companyCode: "ACME", employeeId: "e1", runId: "unpublished" });
  });
  it("blocks finalization until confirmation but preserves pre-feature runs", async () => {
    await expect(assertPayrollReconciliationReady(scope, run)).rejects.toThrow("chưa xác nhận");
    mocks.recordsFind.mockClear();
    await expect(assertPayrollReconciliationReady(scope, { ...run, reconciliationRequired: false })).resolves.toBeUndefined();
    expect(mocks.recordsFind).not.toHaveBeenCalled();
  });
  it("does not permit replies after the provisional period is frozen", async () => {
    mocks.runFind.mockReturnValue(query({ ...run, status: "review" }));
    await expect(actPayrollReconciliation(scope, "run", "e1", { id: "staff", name: "KT", role: "staff" }, 1, { action: "reply", issueId: "i", body: "x" })).rejects.toThrow("tạm tính");
    expect(mocks.recordUpdate).not.toHaveBeenCalled();
  });
});
