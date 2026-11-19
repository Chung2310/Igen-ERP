import { afterEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
import { interpretRequest, validateRemainingRequests } from "./semantic-interpreter";
import { defaultWorkflow, operationById } from "./catalog";
afterEach(() => provider.mockReset());
const employee = defaultWorkflow(operationById("employee.update")!);
describe("semantic interpretation", () => {
  it("does not turn a calendar date into authorization for a recurring schedule", async () => {
    const workflow = defaultWorkflow(operationById("payroll.reconciliation.schedule.update")!);
    provider.mockResolvedValue({ text: JSON.stringify({ actionId: workflow.actionId, values: { dayOfMonth:5, hour:16, recurrence:"monthly" } }) });
    const oneOff = await interpretRequest("Đổi lịch phát hành sang ngày 5/11 lúc 16 giờ", [workflow], null, []);
    expect(oneOff.values).not.toHaveProperty("recurrence");
    const recurring = await interpretRequest("Tôi xác nhận lặp hằng tháng vào ngày 5 lúc 16 giờ", [workflow], null, []);
    expect(recurring.values.recurrence).toBe("monthly");
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
