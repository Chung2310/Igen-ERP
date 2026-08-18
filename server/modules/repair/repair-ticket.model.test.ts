import assert from "node:assert/strict";
import test from "node:test";
import { RepairTicketModel } from "./repair-ticket.model";

test("repair ticket schema stores coverage and supplier claim", () => {
  assert.ok(RepairTicketModel.schema.path("coverage"));
  assert.ok(RepairTicketModel.schema.path("supplierClaim"));
  assert.ok(RepairTicketModel.schema.path("device.serialNumber"));
  assert.ok(RepairTicketModel.schema.indexes().some(([fields]) => fields["companyCode"] && fields["ticketCode"]));
});
