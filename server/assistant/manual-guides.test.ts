import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { buildManualGuide } from "./manual-guides";
import { MANUAL_PROCEDURES } from "./manual-guide-procedures";
import { manualProcedure } from "./manual-guide-procedures";
import { appendAssistantFallback } from "./fallback-guidance";
import { SUPPLEMENTAL_GUIDES } from "./manual-guide-supplement";
import { MANUAL_GUIDE_UNAVAILABLE } from "./manual-guide-unavailable";
import backlog from "./manual-guide-backlog.json";

describe("manual guide catalog", () => {
  it("resolves every one of the 397 original gaps without disguising unavailable UI as instructions", () => {
    expect(new Set(backlog).size).toBe(397);
    for (const id of backlog) {
      const op = operationById(id);
      expect(op, id).toBeDefined();
      const guide = buildManualGuide(op!);
      expect(["procedure", "ui-unavailable"], id).toContain(guide.status);
      if (guide.status === "ui-unavailable") {
        expect(MANUAL_GUIDE_UNAVAILABLE[id], id).toBeDefined();
        expect(guide.evidence.some(e => e.kind === "audit"), id).toBe(true);
        expect(guide.link, id).toBeUndefined();
        expect(guide.steps, id).toEqual([]);
      }
    }
  });

  it("keeps audited gaps traceable to real operations and source files", () => {
    for (const [id, entry] of Object.entries(MANUAL_GUIDE_UNAVAILABLE)) {
      expect(operationById(id), id).toBeDefined();
      expect(entry.files.length, id).toBeGreaterThan(0);
      for (const file of entry.files) expect(fs.existsSync(file), `${id}: ${file}`).toBe(true);
    }
    const ids = SUPPLEMENTAL_GUIDES.flatMap(g => g.operationIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not use endpoint sharing to turn a read into a write", () => {
    const read = buildManualGuide(operationById("customer.billing.profile.list")!);
    const write = buildManualGuide(operationById("customer.billing.profile.create")!);
    expect(read.procedureId).not.toBe(write.procedureId);
    expect(read.steps.join(" ")).not.toContain("chọn Thêm hồ sơ VAT");
    expect(write.steps.join(" ")).toContain("chọn Thêm hồ sơ VAT");
    const original = operationById("customer.billing.profile.create")!;
    expect(manualProcedure({ ...original, method: "DELETE", path: "/unknown" })).toBeUndefined();
  });

  it("routes cross-module fallback instructions to their actual workspaces", () => {
    expect(buildManualGuide(operationById("retail.receivable.customer.history")!).link).toBe("/quan-ly-khach-hang");
    expect(buildManualGuide(operationById("retail.warranty.lookup.phone")!).link).toBe("/sua-chua-bao-hanh");
    expect(buildManualGuide(operationById("api.get.09ba89f080717c4a")!).link).toBe("/pos");
    const op = operationById("retail.receivable.customer.history")!;
    const reply = appendAssistantFallback({ status: "failed", reply: "Chưa tải được." }, { operation: op, workflows: [defaultWorkflow(op)], reason: "technical" });
    expect(reply.reply).toContain("Mở Khách hàng → Hồ sơ khách hàng → Công nợ.");
    expect(reply.reply).not.toContain("Mở tab BÁN LẺ");
  });

  it.each(["retail.order.draft.create", "omni-inbox.leads.export-google-sheets", "retail.shift.pause"])("does not suggest a different write when %s has no manual equivalent", id => {
    const op = operationById(id)!;
    const result = appendAssistantFallback({ status: "failed", reply: "Dịch vụ tạm thời lỗi." }, { operation: op, workflows: [defaultWorkflow(op)], reason: "technical" });
    expect(result.reply).toContain("Dịch vụ tạm thời lỗi.");
    expect(result.link).toBeUndefined();
    expect(buildManualGuide(op).steps).toEqual([]);
  });
  it.each(["/students/bulk-preview", "/students/bulk-delete-preview", "/quotation/catalog/import/preview"])("stops at preview for %s", path => {
    const guide = manualProcedure({ method: "POST", path });
    expect(guide).toBeDefined();
    expect(guide!.steps.join(" ")).toMatch(/Dừng|dừng/);
    expect(guide!.steps.join(" ")).not.toContain("Khi muốn lưu");
  });

  it("routes partner commission accounting to retail finance", () => {
    const original = ASSISTANT_OPERATIONS.find(op => op.module === "retail-partner")!;
    const guide = buildManualGuide({ ...original, path: "/retail/finance/commission/partners/:id/statement" });
    expect(guide.link).toBe("/ban-le?sub=tai-chinh");
  });

  it("withholds unavailable payroll panels", () => {
    const original = ASSISTANT_OPERATIONS.find(op => op.module === "hr")!;
    for (const path of ["/payroll/formulas", "/payroll/runs/:id/payments", "/payroll/periods/:periodKey/inputs"]) {
      const guide = buildManualGuide({ ...original, method: "PUT", path });
      expect(guide.status).toBe("ui-unavailable");
      expect(guide.steps).toEqual([]);
      expect(guide.link).toBeUndefined();
    }
  });
  it("accounts for every current operation without counting navigation as a complete procedure", () => {
    for (const op of ASSISTANT_OPERATIONS) {
      const guide = buildManualGuide(op);
      expect(guide.operationId).toBe(op.id);
      if (guide.status === "procedure") {
        expect(guide.steps.length, op.id).toBeGreaterThanOrEqual(2);
        expect(guide.evidence.some(e => e.kind === "procedure"), op.id).toBe(true);
        expect(guide.link, op.id).toMatch(/^\/(?!\/)/);
      } else expect(guide.steps, op.id).toEqual([]);
    }
  });

  it("keeps all cited controls present in the current source", () => {
    const sources = new Map<string, string>();
    for (const recipe of [...MANUAL_PROCEDURES, ...SUPPLEMENTAL_GUIDES]) for (const e of recipe.evidence) {
      if (!sources.has(e.file)) sources.set(e.file, fs.readFileSync(e.file, "utf8"));
      expect(sources.get(e.file)!.includes(e.contains), `${recipe.id}: ${e.file} missing ${e.contains}`).toBe(true);
    }
  }, 30000);

  it.each(["student.payment.create", "inventory.transfer.create", "quotation.contract.sign", "retail.order.cancel"])("never instructs replay of %s after an uncertain write", id => {
    const op = operationById(id)!;
    const guide = buildManualGuide(op);
    const reply = appendAssistantFallback({ status: "uncertain", reply: "Mất kết nối sau khi gửi yêu cầu." }, { operation: op, workflows: [defaultWorkflow(op)], reason: "uncertain" });
    expect(reply.reply).toContain("không thực hiện lại");
    for (const step of guide.steps.slice(1)) expect(reply.reply).not.toContain(step);
    expect(reply.status).toBe("uncertain");
  });

  it("uses the operation-specific procedure and keeps the API refusal", () => {
    const op = operationById("inventory.transfer.create")!;
    const reply = appendAssistantFallback({ status: "failed", reply: "Số lượng vượt tồn kho gửi." }, { operation: op, workflows: [defaultWorkflow(op)], reason: "validation" });
    expect(reply.reply).toContain("Số lượng vượt tồn kho gửi.");
    expect(reply.reply).toContain("Xuất chuyển kho");
    expect(reply.link).toContain("sub=dieu-chuyen");
  });

  it("withholds manual write steps when permissions are denied", () => {
    const op = operationById("inventory.transfer.create")!;
    const reply = appendAssistantFallback({ status: "failed", reply: "Không có quyền." }, { operation: op, workflows: [defaultWorkflow(op)], reason: "permission" });
    expect(reply.reply).toContain("Chỉ tiếp tục sau khi được cấp quyền");
    expect(reply.reply).not.toContain("Xuất chuyển kho");
    expect(reply.link).toBeUndefined();
  });

  it("does not navigate to a hidden module, with or without an interpreted operation", () => {
    const op = ASSISTANT_OPERATIONS.find(op => op.module === "social-marketing")!;
    expect(buildManualGuide(op).status).toBe("ui-unavailable");
    for (const operation of [op, undefined]) {
      const reply = appendAssistantFallback({ status: "unsupported", reply: "Chưa thực hiện." }, { operation, module: op.module, workflows: [defaultWorkflow(op)], reason: "unsupported" });
      expect(reply.link).toBeUndefined();
      expect(reply.reply).toContain("bị ẩn");
      expect(reply.reply).not.toContain("Mở tab CHIẾN DỊCH");
    }
  });

  it("does not promote a new unknown endpoint into a verified write procedure", () => {
    const original = operationById("student.create")!;
    const op = { ...original, id: "student.new-action", path: "/students/:id/new-action" };
    const guide = buildManualGuide(op);
    expect(guide.status).toBe("navigation-only");
    const reply = appendAssistantFallback({ status: "failed", reply: "Chưa xử lý được." }, { operation: op, workflows: [defaultWorkflow(op)], reason: "technical" });
    expect(reply.reply).toContain("chưa xác minh đủ các bước");
    expect(reply.reply).not.toContain("Lưu hồ sơ");
  });
});
