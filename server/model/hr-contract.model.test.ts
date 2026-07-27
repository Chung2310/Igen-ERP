import { describe, expect, it } from "vitest";
import { HRContractExtensionModel, HRContractModel } from "./hr-contract.model";

describe("HR contract persistence", () => {
  it("requires the complete employee contract fields", () => {
    const error = new HRContractModel({ companyCode: "ACME", employeeId: "employee", employeeName: "An", createdBy: "admin" }).validateSync();
    expect(error?.errors.contractType).toBeTruthy();
    expect(error?.errors.startDate).toBeTruthy();
    expect(error?.errors.endDate).toBeTruthy();
  });

  it("accepts document and signed image links", () => {
    const contract = new HRContractModel({ companyCode: "ACME", contractType: "Xác định thời hạn", employeeId: "employee", employeeName: "An", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), status: "active", contractFileUrl: "https://example.com/contract.pdf", signedImageUrl: "https://example.com/signed.jpg", createdBy: "admin" });
    expect(contract.validateSync()).toBeUndefined();
  });

  it("stores the old and new expiry dates for every extension", () => {
    const extension = new HRContractExtensionModel({ companyCode: "ACME", contractId: "contract", employeeId: "employee", employeeName: "An", previousEndDate: new Date("2026-12-31"), newEndDate: new Date("2027-12-31"), extensionDate: new Date("2026-12-01"), createdBy: "admin" });
    expect(extension.validateSync()).toBeUndefined();
  });
});
