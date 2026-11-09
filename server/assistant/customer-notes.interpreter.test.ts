import { afterEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
import { interpretRequest } from "./interpreter";
import { defaultWorkflow, operationById } from "./catalog";

afterEach(() => provider.mockReset());

describe("customer notes interpretation", () => {
  it("preserves customer facts without dedicated fields as labeled notes", async () => {
    const workflow = defaultWorkflow(operationById("customer.create")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: workflow.actionId, values: {
      name: "An", phone: "0901234567", notes: "Khách thân thiết", "Ngân sách": "50 triệu", "Giờ liên hệ": "Buổi chiều",
      companyCode: "OTHER", password: "PRIVATE",
    } }) });
    const result = await interpretRequest("Tạo khách An, số 0901234567, ngân sách 50 triệu, chỉ liên hệ buổi chiều", [workflow], null, []);
    expect(result.values).toEqual({ name: "An", phone: "0901234567", notes: "Khách thân thiết\nNgân sách: 50 triệu\nGiờ liên hệ: Buổi chiều" });
    expect(workflow.instructions).toContain("không có trường riêng");
  });

  it("keeps a customer update reference while moving extra facts into notes", async () => {
    const workflow = defaultWorkflow(operationById("customer.update")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: workflow.actionId, values: { path_id: "KH-001", "Nhu cầu": "Sơn nội thất" } }) });
    await expect(interpretRequest("Bổ sung khách KH-001 nhu cầu sơn nội thất", [workflow], null, [])).resolves.toMatchObject({
      actionId: workflow.actionId, values: { path_id: "KH-001", notes: "Nhu cầu: Sơn nội thất" },
    });
  });

  it("retains notes across follow-up answers without carrying them to a different customer", async () => {
    const workflow = defaultWorkflow(operationById("customer.update")!);
    const pending = { actionId: workflow.actionId, values: { path_id: "KH-001", notes: "Ngân sách: 50 triệu" } };
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: workflow.actionId, values: { notes: "Chỉ gọi buổi chiều" } }) });
    expect((await interpretRequest("Chỉ gọi buổi chiều", [workflow], pending, [])).values.notes).toBe("Ngân sách: 50 triệu\nChỉ gọi buổi chiều");
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: workflow.actionId, newRequest: true, values: { path_id: "KH-002", notes: "Khách mới" } }) });
    expect((await interpretRequest("Sửa khách KH-002, ghi chú khách mới", [workflow], pending, [])).values.notes).toBe("Khách mới");
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: workflow.actionId, values: { path_id: "KH-002", notes: "Khách mới" } }) });
    expect((await interpretRequest("Chuyển sang khách KH-002", [workflow], pending, [])).values.notes).toBe("Khách mới");
  });
});
