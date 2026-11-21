import { afterEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
import { interpretRequest, validateRemainingRequests } from "./semantic-interpreter";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { quotationIntent } from "./quotation-intent";
import { withAssistantExecution } from "./execution-control";
afterEach(() => { provider.mockReset(); vi.unstubAllEnvs(); });
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
  const recoveryCases: Array<[string, string, Record<string, unknown>]> = [
    ["worker.project.create", "tạo 1 dự án mới tên vinscon20 quản lí lao động", { name: "vinscon20" }],
    ["employee.update", "Đổi chức danh nhân viên Lan thành kế toán", { id: "Lan", jobTitle: "kế toán" }],
    ["worker.project.delete", "Xóa dự án P-10 trong quản lý lao động", { path_id: "P-10" }],
    ["product.list", "Xem danh sách sản phẩm", {}],
  ];
  it.each(recoveryCases)("rechecks a false unsupported decision against authorized tools: %s", async (id, text, values) => {
    const workflows = [defaultWorkflow(operationById(id)!)];
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionIds: [id] }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: id, values, intentType: "workflow" }) });
    expect(await interpretRequest(text, workflows, null, [])).toMatchObject({ actionId: id, values, intentType: "workflow" });
    expect(provider).toHaveBeenCalledTimes(3);
  });
  it("recovers a worker create excluded by module discovery using the full authorized catalog", async () => {
    const workflows = ASSISTANT_OPERATIONS.map(defaultWorkflow);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ modules: ["hr"] }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: { name: "invented" }, intentType: "unsupported" }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionIds: ["worker.project.create"] }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: "worker.project.create", values: { name: "VINSCON20" }, intentType: "workflow" }) });
    const result = await interpretRequest("Tạo dự án VINSCON20 cho 5 công nhân", workflows, null, []);
    expect(result).toMatchObject({ actionId: "worker.project.create", values: { name: "VINSCON20" } });
    expect(result.values).not.toHaveProperty("code");
    const routing = provider.mock.calls[2][0];
    const focused = provider.mock.calls[3][0];
    expect(routing.messages[0].content).toContain("worker.project.create");
    expect(focused.messages[0].content).toContain('"actionId":"worker.project.create"');
    expect(focused.messages[0].content).not.toContain('"actionId":"employee.create"');
    expect(provider).toHaveBeenCalledTimes(4);
  });
  it.each(["not.allowed", "worker.project.create"])("rejects an unauthorized or disabled recovery candidate: %s", async id => {
    const disabled = { ...defaultWorkflow(operationById("worker.project.create")!), enabled: false };
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionIds: [id] }) });
    await expect(interpretRequest("Tạo dự án", [employee, disabled], null, [])).rejects.toThrow("ngoài danh mục");
    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls[1][0].messages[0].content).not.toContain('"actionId":"worker.project.create"');
  });
  it.each([
    { intentType: "ambiguous", cancel: true },
    { intentType: "unsupported", cancel: true },
    { intentType: "general_question" },
    { intentType: "ambiguous", clarification: "Bạn muốn dự án nội bộ hay lao động?" },
  ])("does not recover cancellation, questions, or an existing clarification: %j", async classification => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, ...classification }) });
    expect((await interpretRequest("Không tạo nữa", [employee], null, [])).actionId).toBeNull();
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("does not loop if the focused interpreter still cannot select a tool", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionIds: [employee.actionId] }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
    expect(await interpretRequest("Sửa nhân sự", [employee], null, [])).toMatchObject({ actionId: null, intentType: "ambiguous", values: {} });
    expect(provider).toHaveBeenCalledTimes(3);
  });
  it("does not invent a tool if the capability check has no match", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionIds: [] }) });
    expect((await interpretRequest("Chức năng không có", [employee], null, [])).intentType).toBe("unsupported");
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it("does not recover with an empty authorized catalog", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
    expect((await interpretRequest("Tạo dự án", [], null, [])).actionId).toBeNull();
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it.each([{ cancel: null }, { newRequest: "yes" }])("rejects invalid control flags before attempting recovery: %j", async flags => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported", ...flags }) });
    await expect(interpretRequest("Tạo dự án", [employee], null, [])).rejects.toThrow("không hợp lệ");
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("keeps clarification when recovery finds multiple possible tools", async () => {
    const create = defaultWorkflow(operationById("employee.create")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionIds: [employee.actionId, create.actionId] }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "ambiguous", clarification: "Bạn muốn tạo nhân viên mới hay sửa hồ sơ đã có?" }) });
    expect(await interpretRequest("Bổ sung nhân viên Lan", [employee, create], null, [])).toMatchObject({ actionId: null, intentType: "ambiguous", clarification: "Bạn muốn tạo nhân viên mới hay sửa hồ sơ đã có?" });
    expect(provider).toHaveBeenCalledTimes(3);
  });
  it("does not use payload values from the tool shortlist", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionIds: [employee.actionId], values: { id: "invented", monthlySalary: 999 } }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: employee.actionId, values: { id: "Lan", jobTitle: "kế toán" }, intentType: "workflow" }) });
    const result = await interpretRequest("Đổi chức danh Lan thành kế toán", [employee], null, []);
    expect(result.values).toEqual({ id: "Lan", jobTitle: "kế toán" });
    expect(JSON.stringify(provider.mock.calls[2][0])).not.toContain("invented");
  });
  it("does not allow focused extraction to select a tool outside its shortlist", async () => {
    const create = defaultWorkflow(operationById("employee.create")!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionIds: [employee.actionId] }) });
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: create.actionId, values: {}, intentType: "workflow" }) });
    await expect(interpretRequest("Đổi chức danh Lan", [employee, create], null, [])).rejects.toThrow("ngoài danh mục");
  });
  it("surfaces a capability provider failure without dispatch or another fallback", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
    provider.mockRejectedValueOnce(new Error("fixture provider unavailable"));
    await expect(interpretRequest("Sửa nhân viên Lan", [employee], null, [])).rejects.toThrow("fixture provider unavailable");
    expect(provider).toHaveBeenCalledTimes(2);
  });
  it("stops before recovery if cancellation arrives after the first classification", async () => {
    vi.stubEnv("ASSISTANT_SAFE_EXECUTION", "true");
    const controller = new AbortController();
    provider.mockImplementationOnce(async () => {
      controller.abort();
      return { text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) };
    });
    await expect(withAssistantExecution({ deadlineAt: Date.now() + 10_000, signal: controller.signal }, () => interpretRequest("Sửa nhân viên Lan", [employee], null, []))).rejects.toThrow("Đã dừng");
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it.each(["invalid JSON", '{"actionIds":null}', '{"actionIds":[1]}', '{"actionIds":["a","b","c","d","e","f"]}'])("fails safely on invalid capability output: %s", async raw => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {}, intentType: "unsupported" }) });
    provider.mockResolvedValueOnce({ text: raw });
    await expect(interpretRequest("Tạo dự án", [employee], null, [])).rejects.toThrow();
    expect(provider).toHaveBeenCalledTimes(2);
  });
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
