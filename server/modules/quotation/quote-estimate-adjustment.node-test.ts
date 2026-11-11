import test from "node:test";
import assert from "node:assert/strict";
import { applyAdjustment, validateAdjustment, estimateAnswers, estimateForRegeneration } from "./quote-estimate-adjustment.js";
import { estimateFromCustomerQuote } from "./quote-from-customer.js";
import type { Quote } from "./types.js";

const now = new Date("2026-10-23T00:00:00Z");
const source: Quote = {
  companyId: "company-a", kind: "customer", quoteNumber: "BG-001", requestId: "",
  customerName: "Khách A", customerEmail: "", lines: [{ catalogItemId: "item-1", sku: "BAN", name: "Bàn", description: "Gỗ", quantity: 2, unit: "cái", unitPrice: 1_500_000, currency: "VND", attributes: {}, lineTotal: 3_000_000 }],
  subtotal: 3_000_000, taxRate: 0, taxAmount: 0, total: 3_000_000, currency: "VND", informationNeeded: [], informationConfirmed: true,
  status: "approved", createdBy: "owner", createdAt: now, updatedAt: now,
};
const base = () => estimateFromCustomerQuote(source, "source-id", { id: "template-id", originalFilename: "mau.xlsx" }, "BG-002", "key", "sales", now);

test("AI đổi số lượng thì tính lại tiền theo đơn giá gốc", () => {
  const adjusted = applyAdjustment(base(), validateAdjustment({ changes: [{ index: 0, quantity: 4 }], additions: [], questions: [] }, 1));
  assert.equal(adjusted.lines[0]?.unitPrice, 1_500_000);
  assert.equal(adjusted.total, 6_000_000);
  assert.equal(adjusted.status, "draft");
});

test("thay quy cách và thêm sản phẩm thì yêu cầu nhập giá mới", () => {
  const adjusted = applyAdjustment(base(), validateAdjustment({ changes: [{ index: 0, description: "Gỗ óc chó" }], additions: [{ name: "Ghế", quantity: 2, unit: "cái" }], questions: ["Xác nhận kích thước ghế?"] }, 1));
  assert.equal(adjusted.lines.length, 2);
  assert.ok(adjusted.lines.every((line) => line.priceUnavailable && line.unitPrice === 0));
  assert.equal(adjusted.status, "needs_info");
  assert.equal(adjusted.informationNeeded.length, 3);
  assert.match(adjusted.lines[1]!.supplementalFor!, /#2:/);
});

test("từ chối chỉ số dòng không hợp lệ và phương án xóa hết", () => {
  assert.throws(() => validateAdjustment({ changes: [{ index: 2, quantity: 3 }], additions: [], questions: [] }, 1));
  assert.throws(() => applyAdjustment(base(), validateAdjustment({ changes: [{ index: 0, remove: true }], additions: [], questions: [] }, 1)));
});

test("tạo lại theo câu trả lời giữ VAT, phí vận chuyển và câu hỏi chưa trả lời", () => {
  const estimate = { ...base(), taxRate: 0.1, taxRateConfirmed: true, shippingFee: 50000, shippingFeeConfirmed: true,
    informationNeeded: ["Câu hỏi bổ sung: Cần bao nhiêu bàn?", "Câu hỏi bổ sung: Địa chỉ giao hàng?"] };
  const answers = estimateAnswers(estimate, { "Câu hỏi bổ sung: Cần bao nhiêu bàn?": " 4 bàn " });
  const regenerated = applyAdjustment(estimateForRegeneration(estimate, answers), validateAdjustment({ changes: [{ index: 0, quantity: 4 }], additions: [], questions: [] }, 1));
  assert.equal(regenerated.lines[0]?.unitPrice, 1500000);
  assert.equal(regenerated.taxAmount, 600000);
  assert.equal(regenerated.total, 6650000);
  assert.deepEqual(regenerated.informationNeeded, ["Câu hỏi bổ sung: Địa chỉ giao hàng?"]);
  assert.equal(regenerated.additionalInformation?.["Câu hỏi bổ sung: Cần bao nhiêu bàn?"], "4 bàn");
});

test("giữ mã dòng chưa có giá qua lần tạo lại và xóa mã hàng cũ khi đổi quy cách", () => {
  const changed = applyAdjustment(base(), validateAdjustment({ changes: [{ index: 0, description: "Gỗ khác" }], additions: [], questions: [] }, 1));
  assert.equal(changed.lines[0]?.sku, "");
  assert.deepEqual(changed.lines[0]?.catalogAttributes, {});
  const again = applyAdjustment(changed, validateAdjustment({ changes: [], additions: [], questions: [] }, 1));
  assert.equal(again.lines[0]?.catalogItemId, changed.lines[0]?.catalogItemId);
  assert.equal(again.lines[0]?.priceUnavailable, true);
  assert.throws(() => estimateAnswers(base(), { "Câu hỏi giả": "đổi giá" }));
});

test("không làm mất sản phẩm đang gợi ý khi tạo lại theo câu trả lời", () => {
  const field = "Sản phẩm cần bổ sung giá #1: Ghế";
  const estimate = { ...base(), informationNeeded: [field, "Câu hỏi bổ sung: Loại ghế?"], suggestedProducts: [{ name: "Ghế", description: "Ghế làm việc", unit: "cái", quantity: 2, informationField: field }] };
  const prepared = estimateForRegeneration(estimate, { "Câu hỏi bổ sung: Loại ghế?": "Giữ như cũ" });
  assert.equal(prepared.lines.length, 2);
  const regenerated = applyAdjustment(prepared, validateAdjustment({ changes: [], additions: [], questions: [] }, 2));
  assert.equal(regenerated.lines[1]?.priceUnavailable, true);
  assert.equal(regenerated.lines[1]?.quantity, 2);
  assert.deepEqual(regenerated.informationNeeded, [field]);
});
