import { describe, expect, it } from "vitest";
import { buildWorkerProjectQuery, normalizeWorkerProjectInput } from "./worker-project.service";
import { Types } from "mongoose";

describe("worker project service", () => {
  it("scopes projects by company and branch", () => {
    const HN_id = new Types.ObjectId();
    const query = buildWorkerProjectQuery({ companyCode: "ACME", branchId: HN_id.toString() });
    
    expect(query.companyCode).toBe("ACME");
    expect(query.branchId).toBeInstanceOf(Types.ObjectId);
    expect(query.branchId!.toString()).toBe(HN_id.toString());
    expect(query.deletedAt).toBeNull();
  });

  it("requires a project name and normalizes project defaults", () => {
    expect(() => normalizeWorkerProjectInput({ name: "" })).toThrow("Project name is required");
    
    const normalized = normalizeWorkerProjectInput({
      name: " Site A ",
      code: " da-1 ",
      startTime: "",
      endTime: "",
    });

    expect(normalized).toMatchObject({
      name: "Site A",
      code: "DA-1",
      startTime: "08:00",
      endTime: "17:00",
      workerIds: [],
    });
  });
});
