import { expect, test } from "vitest";
import { RepairTicketModel } from "./repair-ticket.model";

test("repair ticket schema stores coverage and supplier claim", () => {
  expect(RepairTicketModel.schema.path("coverage")).toBeTruthy();
  expect(RepairTicketModel.schema.path("supplierClaim")).toBeTruthy();
  expect(RepairTicketModel.schema.path("device.serialNumber")).toBeTruthy();
  expect(RepairTicketModel.schema.indexes().some(([fields]) => fields["companyCode"] && fields["ticketCode"])).toBe(true);
});
