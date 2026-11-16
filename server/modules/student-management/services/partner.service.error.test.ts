import assert from "node:assert/strict";
import test from "node:test";
import { ConflictError } from "../../../errors/app-error";
import { Partner } from "../models/partner.model";
import { PartnerService } from "./partner.service";

test("createPartner reports a stable conflict when phone already exists in branch", async () => {
  const originalFindOne = Partner.findOne;
  const originalWrites = PartnerService.customFieldWrites;
  let query: unknown;
  (Partner as any).findOne = async (value: unknown) => { query = value; return { _id: "existing" }; };
  PartnerService.customFieldWrites = {
    prepareCreate: async (_context: unknown, data: unknown) => data,
  } as any;

  try {
    await assert.rejects(
      () => PartnerService.createPartner("owner-1", {
        name: "Đối tác A",
        phone: "0123456750",
        commissionType: "fixed",
        commissionValue: 0,
        branchId: "branch-1",
      } as any, { tenantId: "tenant-1", moduleKey: "partners", actorRole: "admin" } as any),
      (error: unknown) => error instanceof ConflictError
        && error.code === "PARTNER_PHONE_ALREADY_EXISTS"
        && error.status === 409
        && error.details?.field === "phone",
    );
    assert.deepEqual(query, { ownerId: "owner-1", phone: "0123456750", branchId: "branch-1" });
  } finally {
    (Partner as any).findOne = originalFindOne;
    PartnerService.customFieldWrites = originalWrites;
  }
});