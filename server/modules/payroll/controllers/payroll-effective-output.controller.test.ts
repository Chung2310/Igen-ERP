import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculatePayrollChecksum } from "../services/payroll-checksum.service";
import { createPayrollEffectiveLineLoader } from "../services/payroll-effective-line.service";

const mocks = vi.hoisted(() => ({
  runFindOne: vi.fn(),
  revisionFindOne: vi.fn(),
  overrideFind: vi.fn(),
  paymentFind: vi.fn(),
  publicationFind: vi.fn(),
  publicationFindOne: vi.fn(),
  publicationFindOneAndUpdate: vi.fn(),
  exportCreate: vi.fn(),
  permissions: vi.fn(),
  buildWorkbook: vi.fn(),
  workbookBuffer: vi.fn(),
}));

vi.mock("../models/payroll-run.model", () => ({ PayrollRunModel: { findOne: mocks.runFindOne } }));
vi.mock("../models/payroll-calculation-revision.model", () => ({
  PayrollCalculationRevisionModel: { findOne: mocks.revisionFindOne },
}));
vi.mock("../models/payroll-line-override.model", () => ({ PayrollLineOverrideModel: { find: mocks.overrideFind } }));
vi.mock("../models/payroll-payment.model", () => ({ PayrollPaymentModel: { find: mocks.paymentFind } }));
vi.mock("../../../model/payslip-publication.model", () => ({
  PayslipPublicationModel: {
    find: mocks.publicationFind,
    findOne: mocks.publicationFindOne,
    findOneAndUpdate: mocks.publicationFindOneAndUpdate,
  },
}));
vi.mock("../models/payroll-export-job.model", () => ({ PayrollExportJobModel: { create: mocks.exportCreate } }));
vi.mock("../../../middleware/auth", () => ({ getEffectivePermissions: mocks.permissions }));
vi.mock("../services/payroll-export.service", () => ({
  buildPayrollWorkbook: mocks.buildWorkbook,
  workbookBuffer: mocks.workbookBuffer,
}));

import { payrollController } from "./index";

const scope = { companyCode: "ACME", branchId: "branch-a" };
const systemLines = [{
  employeeId: "employee-a",
  employeeName: "Employee A",
  calculation: {
    monthlySalary: 10_000,
    adjustedBase: 9_000,
    overtime: 500,
    bonuses: 500,
    gross: 10_000,
    deductions: 100,
    otherDeductions: 100,
    net: 9_900,
  },
  vietnam: { bankAccount: "123", income: { totalIncome: 10_000 }, deductions: { other: 100, total: 100 }, netPay: 9_900 },
  formulaVersion: "vietnam-payroll-1",
  sourceIds: ["contract-a"],
  effectiveSegments: [],
  warnings: [],
}];
const totals = { grossPay: 10_000, deductions: 100, netPay: 9_900 };
const sourceChecksum = calculatePayrollChecksum({ lines: systemLines, totals });
const revision = {
  _id: "revision-a",
  runId: "run-a",
  status: "completed",
  lines: systemLines,
  totals,
  checksum: sourceChecksum,
};
const baseRun = {
  _id: "run-a",
  ...scope,
  periodKey: "2026-07",
  type: "regular",
  status: "closed",
  activeRevisionId: "revision-a",
  activeRevisionChecksum: sourceChecksum,
};

const lean = <T>(value: T) => ({ lean: vi.fn().mockResolvedValue(value) });
const response = () => {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.type = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
};
const request = (body: any = {}, params: any = { id: "run-a", employeeId: "employee-a" }) => ({
  body,
  params,
  headers: {},
  query: {},
  user: { id: "employee-a", role: "admin", ...scope },
}) as any;

describe("effective payroll operational outputs", () => {
  let effectiveSnapshot: any;

  beforeEach(async () => {
    vi.resetAllMocks();
    const loader = createPayrollEffectiveLineLoader({
      getRevision: async () => revision,
      getOverrides: async () => [{
        employeeId: "employee-a",
        adjustedBase: 7_500,
        bonusTotal: 0,
        otherDeductions: 250,
        version: 3,
      }],
    });
    effectiveSnapshot = await loader.createSnapshot(scope, { ...baseRun, status: "draft" });
    mocks.runFindOne.mockReturnValue(lean({ ...baseRun, effectiveSnapshot }));
    mocks.revisionFindOne.mockReturnValue(lean(revision));
    mocks.overrideFind.mockReturnValue(lean([]));
    mocks.paymentFind.mockReturnValue(lean([]));
    mocks.publicationFind.mockReturnValue(lean([{
      runId: "run-a",
      employeeId: "employee-a",
      status: "published",
      revisionChecksum: effectiveSnapshot.checksum,
    }]));
    mocks.publicationFindOne.mockReturnValue(lean({
      runId: "run-a",
      employeeId: "employee-a",
      status: "published",
      revisionChecksum: effectiveSnapshot.checksum,
    }));
    mocks.publicationFindOneAndUpdate.mockImplementation(async (_filter, update) => update.$set);
    mocks.exportCreate.mockResolvedValue({ _id: "export-a" });
    mocks.permissions.mockResolvedValue(new Set(["*"]));
    mocks.buildWorkbook.mockReturnValue({ SheetNames: ["effective"] });
    mocks.workbookBuffer.mockReturnValue(Buffer.from("effective-workbook"));
  });

  it("publishes, returns and prints the pinned effective payslip instead of the immutable system line", async () => {
    const publishResponse = response();
    await payrollController.publishPayslips(request({}), publishResponse);

    expect(mocks.publicationFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-a", employeeId: "employee-a" }),
      { $set: expect.objectContaining({ revisionChecksum: effectiveSnapshot.checksum }) },
      expect.any(Object),
    );

    const employeeResponse = response();
    await payrollController.listEmployeePayslips(request(), employeeResponse);
    expect(employeeResponse.json.mock.calls[0][0].data[0]).toMatchObject({
      employeeId: "employee-a",
      netPay: 7_750,
      checksum: effectiveSnapshot.checksum,
    });

    const printResponse = response();
    await payrollController.printPayslip(request(), printResponse);
    expect(printResponse.send.mock.calls[0][0]).toContain("7750");
    expect(printResponse.send.mock.calls[0][0]).toContain(effectiveSnapshot.checksum);
  });

  it.each(["detailed", "bank_transfer"] as const)(
    "exports pinned effective employee values for %s",
    async (type) => {
      await payrollController.exportPayroll(request({ type }), response());

      expect(mocks.buildWorkbook).toHaveBeenLastCalledWith(type, [
        expect.objectContaining({
          employeeId: "employee-a",
          calculation: expect.objectContaining({ adjustedBase: 7_500, deductions: 250, net: 7_750 }),
        }),
      ]);
      expect(mocks.exportCreate).toHaveBeenLastCalledWith(expect.objectContaining({
        type,
        revisionChecksum: effectiveSnapshot.checksum,
      }));
    },
  );

  it("keeps a pre-upgrade closed publication readable using its source checksum", async () => {
    mocks.runFindOne.mockReturnValue(lean({ ...baseRun, effectiveSnapshot: undefined }));
    mocks.overrideFind.mockReturnValue(lean([]));
    mocks.publicationFind.mockReturnValue(lean([{
      runId: "run-a",
      employeeId: "employee-a",
      status: "published",
      revisionChecksum: sourceChecksum,
    }]));
    mocks.publicationFindOne.mockReturnValue(lean({
      runId: "run-a",
      employeeId: "employee-a",
      status: "published",
      revisionChecksum: sourceChecksum,
    }));

    const listResponse = response();
    await payrollController.listEmployeePayslips(request(), listResponse);
    expect(listResponse.json.mock.calls[0][0].data).toHaveLength(1);

    const printResponse = response();
    await payrollController.printPayslip(request(), printResponse);
    expect(printResponse.send).toHaveBeenCalledWith(expect.stringContaining("9900"));
  });

  it("keeps a pre-upgrade non-revision publication with the legacy checksum readable", async () => {
    mocks.runFindOne.mockReturnValue(lean({
      _id: "run-a",
      ...scope,
      periodKey: "2026-07",
      type: "regular",
      status: "closed",
      lines: systemLines,
      totals,
    }));
    mocks.overrideFind.mockReturnValue(lean([]));
    mocks.publicationFind.mockReturnValue(lean([{
      runId: "run-a",
      employeeId: "employee-a",
      status: "published",
      revisionChecksum: "legacy",
    }]));
    mocks.publicationFindOne.mockReturnValue(lean({
      runId: "run-a",
      employeeId: "employee-a",
      status: "published",
      revisionChecksum: "legacy",
    }));

    const listResponse = response();
    await payrollController.listEmployeePayslips(request(), listResponse);
    expect(listResponse.json.mock.calls[0][0].data).toHaveLength(1);

    const printResponse = response();
    await payrollController.printPayslip(request(), printResponse);
    expect(printResponse.send).toHaveBeenCalledWith(expect.stringContaining("9900"));
  });

  it("does not expose an old publication while its run is only in review", async () => {
    mocks.runFindOne.mockReturnValue(lean({ ...baseRun, status: "review", effectiveSnapshot }));

    const listResponse = response();
    await payrollController.listEmployeePayslips(request(), listResponse);

    expect(listResponse.json).toHaveBeenCalledWith({ status: "success", data: [] });
  });

  it("hides a stale publication checksum after reopen and re-review", async () => {
    mocks.publicationFind.mockReturnValue(lean([{
      runId: "run-a",
      employeeId: "employee-a",
      status: "published",
      revisionChecksum: "checksum-before-reopen",
    }]));
    const listResponse = response();

    await payrollController.listEmployeePayslips(request(), listResponse);

    expect(listResponse.json).toHaveBeenCalledWith({ status: "success", data: [] });
  });

  it("lets an authenticated employee read only their own published line detail", async () => {
    mocks.permissions.mockResolvedValue(new Set());
    const ownResponse = response();

    await payrollController.getLineDetail(request(), ownResponse);

    expect(ownResponse.json).toHaveBeenCalledWith({
      status: "success",
      data: expect.objectContaining({ employeeId: "employee-a", calculation: expect.any(Object) }),
    });

    const otherResponse = response();
    await payrollController.getLineDetail(request({}, {
      id: "run-a",
      employeeId: "employee-b",
    }), otherResponse);

    expect(otherResponse.status).toHaveBeenCalledWith(403);
    expect(otherResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      code: "PAYROLL_PERMISSION_DENIED",
    }));
  });
});
