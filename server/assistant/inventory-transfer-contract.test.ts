import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS } from "./catalog";

describe("assistant inventory transfer contract", () => {
  it("requires a destination warehouse resolved within the selected destination branch", () => {
    const transfer = ASSISTANT_OPERATIONS.find(operation => operation.id === "inventory.transfer.create");
    const warehouses = ASSISTANT_OPERATIONS.find(operation => operation.id === "inventory.warehouse.locations.list");
    const destinationBranch = transfer?.fields.find(field => field.key === "toBranch");
    const destinationWarehouse = transfer?.fields.find(field => field.key === "toWarehouseId");
    const warehouseBranch = warehouses?.fields.find(field => field.key === "targetBranch");

    expect(transfer).toMatchObject({ method: "POST", path: "/inventory/transfers", confirmation: true });
    expect(destinationBranch).toMatchObject({ required: true, reference: "branch.list", referenceValueKey: "id" });
    expect(destinationWarehouse).toMatchObject({
      source: "body",
      apiKey: "toWarehouseId",
      required: true,
      reference: "inventory.warehouse.locations.list",
      referenceParentKey: "toBranch",
      referenceValueKey: "id",
    });

    expect(warehouses).toMatchObject({
      method: "GET",
      path: "/inventory/warehouses",
      permissions: ["inventory:read"],
    });
    expect(warehouseBranch).toMatchObject({ source: "query", apiKey: "branchId" });
  });
});
