import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundError, ValidationError } from "../../../errors/app-error";
import { PartnerController } from "./partner.controller";
import { PartnerService } from "../services/partner.service";

test("partner create forwards typed validation when superadmin omits tenant", async () => {
  let forwarded: unknown;
  await PartnerController.create({ user: { uid: "sa", role: "superadmin" }, body: {}, query: {} } as any, {} as any, ((error: unknown) => { forwarded = error; }) as any);
  assert.equal(forwarded instanceof ValidationError, true);
  assert.equal((forwarded as ValidationError).code, "TENANT_REQUIRED");
});

test("partner detail forwards typed not-found error", async () => {
  const original = PartnerService.getPartnerById;
  (PartnerService as any).getPartnerById = async () => null;
  let forwarded: unknown;
  try {
    await PartnerController.getDetail({ user: { uid: "u1", role: "admin" }, params: { id: "p1" } } as any, {} as any, ((error: unknown) => { forwarded = error; }) as any);
    assert.equal(forwarded instanceof NotFoundError, true);
    assert.equal((forwarded as NotFoundError).code, "PARTNER_NOT_FOUND");
  } finally {
    (PartnerService as any).getPartnerById = original;
  }
});