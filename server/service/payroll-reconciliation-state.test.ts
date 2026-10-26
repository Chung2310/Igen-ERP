import { describe, expect, it } from "vitest";
import { applyReconciliationAction, assertReconciliationReady, publishReconciliation } from "./payroll-reconciliation-state";
const identity = { runId: "run", employeeId: "e1", employeeName: "An", periodKey: "2026-09" };
const line = { employeeId: "e1", effectiveValues: { adjustedBase: 10000000, commission: 0 }, net: 10000000, calculation: { workedMinutes: 480 } };
const employee = { id: "e1", name: "An", role: "employee" as const };
const staff = { id: "a1", name: "Kế toán", role: "staff" as const };
const publish = () => publishReconciliation(undefined, identity, line, "a1", "2026-09-15T01:00:00Z");
describe("payroll reconciliation", () => {
  it("keeps immutable publications and requires employee confirmation", () => {
    const record = publish();
    expect(() => assertReconciliationReady([line], [record])).toThrow("chưa xác nhận");
    const confirmed = applyReconciliationAction(record, { action: "confirm" }, employee);
    expect(() => assertReconciliationReady([line], [confirmed])).not.toThrow();
    expect(record.confirmations).toEqual([]);
    expect(confirmed.confirmations).toHaveLength(1);
    expect(publishReconciliation(confirmed, identity, line, "a1")).toBe(confirmed);
  });
  it("retains questions and replies through correction, resolution and re-confirmation", () => {
    const first = applyReconciliationAction(publish(), { action: "dispute", field: "commission", body: "Thiếu hoa hồng" }, employee);
    const issueId = first.issues[0].id;
    expect(() => applyReconciliationAction(first, { action: "confirm" }, employee)).toThrow("chưa được giải quyết");
    const replied = applyReconciliationAction(first, { action: "reply", issueId, body: "Đang kiểm tra đơn hàng" }, staff);
    const resolved = applyReconciliationAction(replied, { action: "resolve", issueId, body: "Đã bổ sung 500.000 đ" }, staff);
    const corrected = { ...line, effectiveValues: { ...line.effectiveValues, commission: 500000 }, net: 10500000 };
    const next = publishReconciliation(resolved, identity, corrected, "a1");
    expect(next.publications).toHaveLength(2);
    expect(next.publications[0].values.commission).toBe(0);
    expect(next.snapshot.values.commission).toBe(500000);
    expect(next.issues[0].messages.map(message => message.action)).toEqual(["question", "reply", "resolve"]);
    expect(first.issues[0].messages).toHaveLength(1);
    expect(() => assertReconciliationReady([corrected], [next])).toThrow("chưa xác nhận");
    expect(() => assertReconciliationReady([corrected], [applyReconciliationAction(next, { action: "confirm" }, employee)])).not.toThrow();
  });
  it("blocks stale confirmation and unpublished employees at finalization", () => {
    const confirmed = applyReconciliationAction(publish(), { action: "confirm" }, employee);
    expect(() => assertReconciliationReady([{ ...line, net: 999 }], [confirmed])).toThrow("đã thay đổi");
    expect(() => assertReconciliationReady([line, { ...line, employeeId: "e2" }], [confirmed])).toThrow("tất cả nhân viên");
    const newPublication = publishReconciliation(confirmed, identity, { ...line, net: 999 }, "a1");
    expect(newPublication.confirmedChecksum).toBeUndefined();
    expect(newPublication.confirmations).toHaveLength(1);
  });
  it("revokes confirmation on a new complaint and prevents duplicate unresolved complaints", () => {
    const confirmed = applyReconciliationAction(publish(), { action: "confirm" }, employee);
    const action = { action: "dispute" as const, field: "workedMinutes" as const, body: "Thiếu công" };
    const disputed = applyReconciliationAction(confirmed, action, employee);
    expect(disputed.confirmedChecksum).toBeUndefined();
    expect(() => applyReconciliationAction(disputed, action, employee)).toThrow("đang có khiếu nại");
    expect(() => assertReconciliationReady([], [disputed])).toThrow("bỏ khỏi kỳ");
  });
  it("enforces roles and validates complaint contents", () => {
    expect(() => applyReconciliationAction(publish(), { action: "confirm" }, staff)).toThrow("Chỉ nhân viên");
    expect(() => applyReconciliationAction(publish(), { action: "dispute", field: "net", body: " " }, employee)).toThrow("Nội dung");
    expect(() => applyReconciliationAction(publish(), { action: "dispute", field: "bankAccount" as any, body: "x" }, employee)).toThrow("không hợp lệ");
    const record = applyReconciliationAction(publish(), { action: "dispute", field: "net", body: "Sai" }, employee);
    expect(() => applyReconciliationAction(record, { action: "resolve", issueId: record.issues[0].id, body: "x" }, employee)).toThrow("Chỉ kế toán");
  });
});
