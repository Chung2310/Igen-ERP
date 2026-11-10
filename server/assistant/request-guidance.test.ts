import { describe, expect, it } from "vitest";
import type { AssistantWorkflow } from "../../src/shared/assistant-workflow";
import { assistantRequestGuidance } from "./request-guidance";

const workflow = (actionId: string, title: string, enabled = true): AssistantWorkflow => ({
  actionId, title, enabled, module: "test", fields: [], description: "", instructions: "",
  requireConfirmation: false, confirmationLocked: false, version: 0,
});
const patientWorkflows = [workflow("patient.list", "Tra cứu bệnh nhân"), workflow("patient.create", "Tạo bệnh nhân"), workflow("patient.update", "Cập nhật bệnh nhân")];

describe("assistant request guidance", () => {
  it("uses placeholders when the user has not named an entity", () => {
    const guidance = assistantRequestGuidance("Mình muốn nhờ việc này", patientWorkflows);
    expect(guidance).toContain("Ví dụ cách viết");
    expect(guidance).toContain("Xem danh sách [đối tượng]");
    expect(guidance).toContain("Thêm [đối tượng]: [thông tin đã có]");
    expect(guidance).not.toContain("bệnh nhân");
  });
  it("uses an explicitly mentioned entity and only two examples", () => {
    const guidance = assistantRequestGuidance("Mình cần làm việc với bệnh nhân", patientWorkflows);
    expect(guidance).toContain("Xem danh sách bệnh nhân");
    expect(guidance).toContain("Thêm bệnh nhân: [thông tin đã có]");
    expect(guidance.split("\n").filter(line => line.startsWith("- "))).toHaveLength(2);
  });
  it("helps phrase an update without inventing a person or value", () => {
    const guidance = assistantRequestGuidance("sua benh nhan nhu nao", patientWorkflows);
    expect(guidance.split("\n")[1]).toContain("Cập nhật bệnh nhân [tên hoặc mã]: [thông tin cần sửa]");
    expect(guidance).not.toMatch(/Nguyễn|090|đã cập nhật|Mình có thể/);
  });
  it("does not offer disabled actions or entities outside the explicit context", () => {
    const guidance = assistantRequestGuidance("Mình cần giúp về nhân sự", [
      workflow("employee.list", "Tra cứu nhân sự"), workflow("employee.create", "Tạo nhân sự", false), ...patientWorkflows,
    ]);
    expect(guidance).toContain("Xem danh sách nhân sự");
    expect(guidance).not.toMatch(/Thêm|Cập nhật|bệnh nhân/);
  });
  it("does not mention entities when only part of a word matches", () => {
    const guidance = assistantRequestGuidance("bệnh nhânan", patientWorkflows);
    expect(guidance).toContain("[đối tượng]");
    expect(guidance).not.toContain("bệnh nhân");
  });
  it("works for new modules without module-specific examples and deduplicates titles", () => {
    const guidance = assistantRequestGuidance("vat tu", [workflow("new.list", "Tra cứu vật tư"), workflow("other.list", "Tra cứu vật tư"), workflow("new.create", "Tạo vật tư")]);
    expect(guidance).toContain("Xem danh sách vật tư");
    expect(guidance.split("Xem danh sách vật tư")).toHaveLength(2);
    expect(guidance).toContain("Thêm vật tư");
  });
  it("gives a general phrasing template when no eligible examples exist", () => {
    expect(assistantRequestGuidance("giúp tôi", [])).toContain("Tôi muốn [việc cần làm] với [đối tượng]");
    expect(assistantRequestGuidance("giúp tôi", [workflow("disabled.list", "Tra cứu nội bộ", false)])).not.toContain("nội bộ");
  });
  it("helps describe the purpose of an attachment without assuming an import", () => {
    const guidance = assistantRequestGuidance("làm giúp mình", patientWorkflows, true);
    expect(guidance).toBe("Ví dụ cách viết: “Dùng tệp này để [việc cần làm] cho [đối tượng]”.");
    expect(guidance).not.toMatch(/bệnh nhân|nhập|tạo|cập nhật/);
  });
});
