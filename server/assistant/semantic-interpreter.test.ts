import { afterEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
import { interpretRequest, validateRemainingRequests } from "./semantic-interpreter";
import { defaultWorkflow, operationById } from "./catalog";
import { quotationIntent } from "./quotation-intent";
afterEach(() => provider.mockReset());
const employee = defaultWorkflow(operationById("employee.update")!);
describe("estimate versus budget routing", () => {
  const workflows = ["quotation.budget.create", "quotation.request.create", "quotation.estimate.create", "quotation.estimate.from-customer"].map(id => defaultWorkflow(operationById(id)!));
  it.each([
    ["Tạo dự toán", "quotation.request.create"],
    ["Lập dự toán lắp camera, ngân sách 100 triệu", "quotation.request.create"],
    ["len du toan cho toi ngan sach 100 trieu", "quotation.request.create"],
    ["Tôi cần một dự toán cho công trình", "quotation.request.create"],
    ["Tạo dự toán, không tạo ngân sách", "quotation.request.create"],
    ["Tạo dự toán từ báo giá BG-001 với ngân sách 100 triệu", "quotation.estimate.from-customer"],
    ["Lập dự toán dựa trên báo giá BG-2026-001", "quotation.estimate.from-customer"],
    ["Tạo dự toán căn cứ vào BG-2026-001", "quotation.estimate.from-customer"],
    ["Lập dự toán từ yêu cầu đã phân tích, ngân sách 100 triệu", "quotation.estimate.create"],
  ])("corrects an incorrect model budget choice: %s", async (text, actionId) => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.budget.create", values: { customerName: "An", budget: 100000000 }, remainingRequests: ["Tạo ngân sách"] }) });
    expect(quotationIntent(text).actionId).toBe(actionId);
    const result = await interpretRequest(text, workflows, null, []);
    expect(result.actionId).toBe(actionId);
    expect(result.values).not.toHaveProperty("budget");
    expect(result.remainingRequests).toEqual([]);
    if (actionId === "quotation.request.create") {
      expect(result.values.requestText).toBe(text);
      expect(result.values.customerName).toBe("An");
    }
  });
  it("keeps a budget constraint on the pending estimate even if AI calls it a new request", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.budget.create", values: {}, newRequest: true }) });
    const result = await interpretRequest("Ngân sách 100 triệu nhé", workflows, { actionId: "quotation.request.create", values: { requestText: "Lắp 10 camera" } }, []);
    expect(result).toMatchObject({ actionId: "quotation.request.create", newRequest: false, values: { requestText: "Lắp 10 camera\nNgân sách 100 triệu nhé" } });
  });
  it.each(["Tạo phương án dự toán ngân sách 100 triệu", "Lập ngân sách 100 triệu", "Đề xuất phương án ngân sách cho dự toán"])("preserves an explicit budget request: %s", async text => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.budget.create", values: {} }) });
    expect((await interpretRequest(text, workflows, { actionId: "quotation.request.create" }, [])).actionId).toBe("quotation.budget.create");
  });
  it("does not substitute a budget when estimate permission is absent", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.budget.create", values: {} }) });
    expect((await interpretRequest("Tạo dự toán", workflows.slice(0, 1), null, [])).actionId).toBeNull();
  });
  it("preserves cancellation", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "quotation.budget.create", values: {}, cancel: true }) });
    expect(await interpretRequest("Không tạo dự toán nữa", workflows, null, [])).toMatchObject({ actionId: null, cancel: true });
  });
});
describe("semantic interpretation", () => {
  it.each(["worker.list", "student.list", "retail.partner.update"])("does not silently execute a partial request in %s", async id => {
    const workflow = defaultWorkflow(operationById(id)!);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: id, values: { unsupportedCondition: "sensitive-value" } }) });
    const result = await interpretRequest("Xử lý đúng tất cả các điều kiện tôi vừa nêu", [workflow], null, []);
    expect(result).toMatchObject({ actionId: null, intentType: "ambiguous", values: {} });
    expect(JSON.stringify(result)).not.toContain("sensitive-value");
  });
  it("preserves equivalent schema names and refuses conflicting values", async () => {
    const workflow = defaultWorkflow(operationById("worker.list")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: workflow.actionId, values: { search: "Lan" } }) });
    expect((await interpretRequest("Tìm lao động Lan", [workflow], null, [])).values).toEqual({ query_search: "Lan" });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: workflow.actionId, values: { search: "Lan", query_search: "An" } }) });
    expect((await interpretRequest("Tìm lao động Lan", [workflow], null, [])).actionId).toBeNull();
  });
  it("does not turn a calendar date into authorization for a recurring schedule", async () => {
    const workflow = defaultWorkflow(operationById("payroll.reconciliation.schedule.update")!);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: workflow.actionId, values: { day:5, hour:16, recurrence:"monthly" } }) });
    const oneOff = await interpretRequest("Đổi lịch phát hành sang ngày 5/11 lúc 16 giờ", [workflow], null, []);
    expect(oneOff.values).not.toHaveProperty("recurrence");
    const recurring = await interpretRequest("Tôi xác nhận lặp hằng tháng vào ngày 5 lúc 16 giờ", [workflow], null, []);
    expect(recurring.values.recurrence).toBe("monthly");
    expect(recurring.values.day).toBe(5);
  });
  it("drops null values so authenticated branch context can be applied", async () => {
    const workflow = defaultWorkflow(operationById("recruitment.interview.list")!);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: workflow.actionId, values: { branchId: null } }) });
    expect((await interpretRequest("Lịch phỏng vấn hôm nay", [workflow], null, [])).values).not.toHaveProperty("branchId");
  });
  it("does not accept invented hours for a date-only event", async () => {
    const workflow = defaultWorkflow(operationById("hr.calendar.event.create")!);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: workflow.actionId, values: { title: "Họp tuần", startDate: "2026-11-21T09:00:00+07:00", endDate: "2026-11-21T10:00:00+07:00" } }) });
    const result = await interpretRequest("Tạo sự kiện Họp tuần vào thứ bảy", [workflow], null, []);
    expect(result.values).toEqual({ title: "Họp tuần" });
  });
  it("normalizes structured JSON arrays without changing reference names", async () => {
    const workflow = defaultWorkflow(operationById("recruitment.interview.update")!);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: workflow.actionId, values: { path_id: "Lan", interviewerIds: ["Minh"] } }) });
    expect((await interpretRequest("Đổi người phỏng vấn Lan thành Minh", [workflow], null, [])).values.interviewerIds).toBe('["Minh"]');
  });
  it.each(["Chị Lan từ nay làm bên kế toán nhé", "chuyen Lan qua ke toan", "Đổi phòng ban nhân viên Lan"])("uses AI for paraphrase: %s", async text => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: employee.actionId, intentType: "workflow", values: {}, remainingRequests: [] }) });
    expect((await interpretRequest(text, [employee], null, [])).actionId).toBe(employee.actionId);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider.mock.calls[0][0].messages.at(-1).content).toBe(text);
  });
  it("rejects unavailable operations and malformed plans", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: "not.allowed", values: {} }) });
    await expect(interpretRequest("làm giúp", [employee], null, [])).rejects.toThrow();
    expect(() => validateRemainingRequests(Array(41).fill("step"))).toThrow();
    expect(() => validateRemainingRequests([{}])).toThrow();
  });
  it("preserves a multi-step goal and supplies context for continuation", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: employee.actionId, values: {}, remainingRequests: ["Tạo việc bàn giao"], newRequest: false }) });
    const result = await interpretRequest("Chuyển Lan và tạo việc bàn giao", [employee], null, []);
    expect(result.remainingRequests).toEqual(["Tạo việc bàn giao"]);
    await interpretRequest("tiếp tục", [employee], null, [{role:"assistant", content:"Đã cập nhật Lan"}], "", [], JSON.stringify(result.remainingRequests));
    expect(JSON.stringify(provider.mock.calls[1][0])).toContain("Tạo việc bàn giao");
  });
  it("does not let a keyword override cancellation or clarification", async () => {
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: null, values: {}, cancel: true, intentType: "ambiguous", clarification: "Bạn muốn chuyển Lan nào?" }) });
    expect(await interpretRequest("Không chuyển nhân viên Lan nữa", [employee], null, [])).toMatchObject({actionId:null,cancel:true});
  });
  it("discovers new tools from the authorized catalog without a twelve-tool cutoff", async () => {
    const workflows = Array.from({length:121}, (_, i) => ({...employee, actionId:`custom.${i}`, module:"custom"}));
    provider.mockResolvedValueOnce({text:JSON.stringify({modules:["custom"]})});
    provider.mockResolvedValueOnce({text:JSON.stringify({actionId:"custom.120", values:{}, intentType:"workflow"})});
    expect((await interpretRequest("chức năng mới", workflows, null, [])).actionId).toBe("custom.120");
  });
  it.each(['{"modules":["employee","department"]}', 'not json', '{"modules":["hr","unknown"]}', '{"modules":null}'])("recovers from invalid discovery without losing authorized tools: %s", async discovery => {
    const create = defaultWorkflow(operationById("employee.create")!);
    const workflows = [create, ...Array.from({length:120}, (_, i) => ({...employee, actionId:`custom.${i}`}))];
    provider.mockResolvedValueOnce({text:discovery});
    provider.mockResolvedValueOnce({text:JSON.stringify({actionId:create.actionId, values:{displayName:"Hoàng Tài",department:"công nghệ thông tin"}, intentType:"workflow"})});
    const result = await interpretRequest("thêm cho tôi nhân sự tên là Hoàng Tài, thuộc phòng công nghệ thông tin", workflows, null, []);
    expect(result.actionId).toBe("employee.create");
    expect(result.values.displayName).toBe("Hoàng Tài");
    expect(provider).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(provider.mock.calls[1][0].messages)).toContain("custom.119");
  });
  it("retains the permission boundary after discovery fails", async () => {
    const workflows = Array.from({length:121}, (_, i) => ({...employee, actionId:`custom.${i}`}));
    provider.mockRejectedValueOnce(new Error("Discovery unavailable"));
    provider.mockResolvedValueOnce({text:JSON.stringify({actionId:"employee.create",values:{},intentType:"workflow"})});
    await expect(interpretRequest("thêm nhân sự", workflows, null, [])).rejects.toThrow("ngoài danh mục");
  });
});
