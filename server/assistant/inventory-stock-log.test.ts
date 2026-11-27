import { describe, expect, it, vi } from "vitest";
import { operationById, defaultWorkflow } from "./catalog";
import { collectValues, validateField } from "./policy";
import { interpretRequest } from "./semantic-interpreter";

const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));

const operation = operationById("inventory.stock-log.internal.issue.create")!;
const workflow = defaultWorkflow(operation);

describe("internal stock issue assistant contract", () => {
  it("exposes only a confirmed pending internal issue with the inventory permission", () => {
    expect(operation).toBeDefined();
    expect(operation.method).toBe("POST");
    expect(operation.path).toBe("/crud/stock-logs");
    expect(operation.permissions).toEqual(["inventory:manage"]);
    expect(operation.confirmation).toBe(true);
    expect(operation.fixedBodyValues).toEqual({ type: "xuất", purpose: "nội bộ", status: "Đang chờ" });
    expect(workflow.requireConfirmation).toBe(true);
    expect(workflow.confirmationLocked).toBe(true);
    expect(operation.fields.map(field => field.apiKey || field.key)).not.toContain("type");
    expect(operation.fields.map(field => field.apiKey || field.key)).not.toContain("purpose");
    expect(operation.fields.map(field => field.apiKey || field.key)).not.toContain("status");
  });

  it("plans the request against this operation without inventing missing values", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({
      intentType: "workflow",
      actionIntent: "create",
      actionId: operation.id,
      values: {},
      requestCoverage: [{
        evidence: "Tạo phiếu xuất kho nội bộ",
        requirement: "tạo phiếu xuất kho nội bộ",
        mappedTo: ["action"],
      }],
    }) });
    const result = await interpretRequest(
      `${operation.title}. Xử lý đúng thông tin đã cung cấp.`,
      [workflow],
      null,
      [],
      "",
      [],
      "",
      [],
      true,
    );
    expect(result.actionId).toBe(operation.id);
    expect(result.values).toEqual({});
  });

  it("requires branch, warehouse, recipient, reason, operator and item details", () => {
    const missing = collectValues(workflow, {});
    expect(missing.missing).toEqual(expect.arrayContaining([
      "Chi nhánh kho",
      "Kho xuất",
      "Người hoặc phòng ban nhận",
      "Lý do cấp phát nội bộ",
      "Người lập phiếu",
      "Danh sách sản phẩm xuất",
    ]));
    expect(missing.values).not.toHaveProperty("items");
  });

  it("validates positive quantities and requires the identifier list for each SKU", () => {
    const itemField = operation.fields.find(field => field.key === "items")!;
    const baseItem = { productId: "Redmi Note 14", sku: "REDMI-N14", quantity: 1, unitIdentifiers: [] };
    expect(() => validateField(itemField, JSON.stringify([baseItem]))).not.toThrow();
    expect(() => validateField(itemField, JSON.stringify([{ ...baseItem, quantity: 0 }]))).toThrow();
    expect(() => validateField(itemField, JSON.stringify([{ productId: "Redmi Note 14", sku: "REDMI-N14", quantity: 1 }]))).toThrow();
    expect(() => validateField(itemField, JSON.stringify([]))).toThrow();
  });

  it("accepts complete internal issue data without supplying fixed mutation fields", () => {
    const result = collectValues(workflow, {
      targetBranch: "Trụ sở chính",
      warehouseId: "Kho chính",
      customerName: "Bộ phận kế toán",
      notes: "Sử dụng nội bộ",
      operatorName: "Nguyễn An",
      items: JSON.stringify([{ productId: "Redmi Note 14", sku: "REDMI-N14", quantity: 1, unitIdentifiers: ["IMEI-EXAMPLE"] }]),
    });
    expect(result.missing).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.values).not.toHaveProperty("type");
    expect(result.values).not.toHaveProperty("purpose");
    expect(result.values).not.toHaveProperty("status");
  });
});

describe("stock log query contract", () => {
  it("supports bounded date reads and public recipients needed for stock reports", () => {
    const read = operationById("inventory.stock-log.list")!;
    expect(read.method).toBe("GET");
    expect(read.fields.map(field => field.apiKey || field.key)).toEqual(expect.arrayContaining([
      "createdFrom", "createdTo", "page", "limit",
    ]));
    expect(read.fields.find(field => field.apiKey === "limit")?.max).toBe(1000);
    expect(read.assistantOnlyFields).toContain("reportType");
    expect(read.resultFields).toEqual(expect.arrayContaining(["customerName", "notes", "items", "documentType", "count", "from", "to", "finding"]));
    expect(read.resultChildFields?.items).toEqual(["productName", "sku", "quantity"]);
    expect(defaultWorkflow(read).enabled).toBe(true);
  });

  it("uses the assistant query field keys when collecting every transfer page", () => {
    const transfers = operationById("inventory.transfer.list")!;
    expect(transfers.analysis?.pagination).toEqual({ pageField: "query_page", sizeField: "query_limit" });
    expect(transfers.fields.map(field => field.key)).toEqual(expect.arrayContaining(["query_page", "query_limit"]));
  });
});
