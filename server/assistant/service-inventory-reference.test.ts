import { describe, expect, it } from "vitest";
import { defaultWorkflow, operationById } from "./catalog";
import { extractPendingScalarAnswer, missingReferencePrompts } from "./service";
import { matchesReference } from "./executor";

describe("inventory receipt product reference search", () => {
  it("lets a user select duplicate product names by the displayed product code", () => {
    expect(matchesReference({ name: "iPhone 14", productCode: "IP14-TITAN" }, "iPhone 14 [mã SP: IP14-TITAN]")).toBe(true);
    expect(matchesReference({ name: "iPhone 14", productCode: "IP14-BLACK" }, "iPhone 14 [mã SP: IP14-TITAN]")).toBe(false);
  });

  it("keeps the named model from the user's original receipt request", async () => {
    const operation = operationById("inventory.receipt.create")!;
    const contexts: Array<Record<string, unknown>> = [];
    await missingReferencePrompts(
      { headers: {} } as never,
      operation,
      defaultWorkflow(operation),
      { items: JSON.stringify([{ quantity: 5, unitCost: 30_000_000 }]) },
      "T\u1ea1o gi\u00fap t\u00f4i phi\u1ebfu nh\u1eadp 5 m\u00e1y iPhone 14 t\u1eeb nh\u00e0 cung c\u1ea5p IHONE v\u00e0o kho Tr\u1ee5 s\u1edf ch\u00ednh",
      new Set(),
      async (_req, _op, _field, values) => {
        contexts.push(values);
        return [];
      },
    );
    const search = contexts.flatMap(context => Object.entries(context))
      .find(([key]) => key.startsWith("__assistantReferenceSearch_"))?.[1];
    expect(search).toBe("iPhone 14");
  });
});

describe("pending inventory action answers", () => {
  it("maps a labeled short reply to the only missing required text field", () => {
    const operation = operationById("inventory.stock-log.internal.issue.create")!;
    const operatorField = operation.fields.find(field => field.key === "operatorName")!;
    const provided = {
      targetBranch: "branch-id",
      warehouseId: "warehouse-id",
      customerName: "Bộ phận kế toán",
      notes: "Sử dụng nội bộ",
      items: JSON.stringify([{ productId: "product-id", sku: "sku-id", quantity: 1, unitIdentifiers: [] }]),
    };

    expect(extractPendingScalarAnswer(
      defaultWorkflow(operation),
      provided,
      `${operatorField.label} là QA Admin.`,
    )).toEqual({ operatorName: "QA Admin" });
    expect(extractPendingScalarAnswer(defaultWorkflow(operation), provided, "Xem báo cáo kho hôm nay")).toBeUndefined();
  });

  it("keeps a transfer reason and serial supplied in the same pending answer", () => {
    const operation = operationById("inventory.transfer.create")!;
    const reasonField = operation.fields.find(field => field.key === "reason")!;
    const provided = {
      targetBranch: "source-branch",
      toBranch: "destination-branch",
      fromWarehouseId: "source-warehouse",
      toWarehouseId: "destination-warehouse",
      items: JSON.stringify([{ productId: "product-id", variantId: "sku-id", quantity: 1 }]),
    };

    const values = extractPendingScalarAnswer(
      defaultWorkflow(operation),
      provided,
      `${reasonField.label}: Bổ sung hàng. IMEI cần chuyển là QA-SAM-ULTRA-512-INSTOCK-0001-QA-LABOR-HN-1.`,
    );
    expect(values?.reason).toContain("Bổ sung hàng");
    expect(JSON.parse(String(values?.items))).toEqual([{
      productId: "product-id",
      variantId: "sku-id",
      quantity: 1,
      unitIdentifiers: ["QA-SAM-ULTRA-512-INSTOCK-0001-QA-LABOR-HN-1"],
    }]);
  });
});
