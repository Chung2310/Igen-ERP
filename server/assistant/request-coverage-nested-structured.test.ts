import { describe, expect, it } from "vitest";
import { defaultWorkflow, operationById } from "./catalog";
import { validateRequestCoverage } from "./request-coverage";

describe("request coverage for structured collection inputs", () => {
  it("accepts a mapped item quantity when it is represented inside the structured list", () => {
    const operation = operationById("inventory.stock-log.internal.issue.create")!;
    const workflow = defaultWorkflow(operation);
    const values = {
      items: JSON.stringify([{
        productId: "Redmi Note 14",
        sku: "REDMI-N14",
        quantity: 1,
        unitIdentifiers: [],
      }]),
    };

    expect(validateRequestCoverage(
      "Tạo phiếu xuất một máy Redmi Note 14 để bộ phận kế toán sử dụng nội bộ",
      [{
        evidence: "một máy Redmi Note 14",
        requirement: "Số lượng máy cần xuất là một",
        mappedTo: ["values.items[0].quantity"],
      }],
      workflow,
      operation,
      values,
    )).toEqual({ ok: true });
  });

  it("accepts a transfer quantity mapped inside the structured items list", () => {
    const operation = operationById("inventory.transfer.create")!;
    const workflow = defaultWorkflow(operation);

    expect(validateRequestCoverage(
      "Tạo phiếu điều chuyển 2 máy Samsung Galaxy Ultra từ kho Trụ sở chính sang kho KHO2A",
      [{
        evidence: "2 máy Samsung Galaxy Ultra",
        requirement: "Số lượng máy cần điều chuyển là hai",
        mappedTo: ["values.items[0].quantity"],
      }],
      workflow,
      operation,
      { items: JSON.stringify([{
        productId: "Samsung Galaxy Ultra",
        variantId: "Samsung Galaxy Ultra",
        quantity: 2,
        unitIdentifiers: [],
      }]) },
    )).toEqual({ ok: true });
  });

  it("maps a transferred product name and SKU to the declared nested item fields", () => {
    const operation = operationById("inventory.transfer.create")!;
    const workflow = defaultWorkflow(operation);
    const text = "Điều chuyển 2 Samsung Galaxy Ultra SKU SMG-001 từ kho A sang kho B";

    expect(validateRequestCoverage(
      text,
      [
        { evidence: "Samsung Galaxy Ultra", requirement: "Sản phẩm cần điều chuyển", mappedTo: ["values.items[0].productId"] },
        { evidence: "SKU SMG-001", requirement: "Biến thể chính xác cần điều chuyển", mappedTo: ["values.items[0].variantId"] },
        { evidence: "2", requirement: "Số lượng cần điều chuyển", mappedTo: ["values.items[0].quantity"] },
      ],
      workflow,
      operation,
      { items: JSON.stringify([{ productId: "Samsung Galaxy Ultra", variantId: "SMG-001", quantity: 2, unitIdentifiers: [] }]) },
    )).toEqual({ ok: true });
  });

  it("rejects nested fields that the structured input does not declare", () => {
    const operation = operationById("inventory.stock-log.internal.issue.create")!;
    const workflow = defaultWorkflow(operation);

    expect(validateRequestCoverage(
      "Tạo phiếu xuất một máy Redmi Note 14",
      [{
        evidence: "một máy Redmi Note 14",
        requirement: "Giá vốn mỗi máy",
        mappedTo: ["values.items[0].unitCost"],
      }],
      workflow,
      operation,
      { items: JSON.stringify([{ productId: "Redmi Note 14", quantity: 1, unitCost: 5000000 }]) },
    )).toMatchObject({ ok: false });
  });
});
