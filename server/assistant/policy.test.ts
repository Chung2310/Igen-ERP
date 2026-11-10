import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { collectValues, validateWorkflow } from "./policy";
const employee = operationById("employee.create")!;
const draft = () => { const w = defaultWorkflow(employee); return { ...w, fields: w.fields.map(f => ({ key: f.key, required: Boolean(f.required), defaultValue: f.defaultValue })) }; };
describe("assistant workflow policy", () => {
  it("asks for name, birth date and email while defaulting salary to zero", () => {
    const result = collectValues(defaultWorkflow(employee), { displayName: "Đỗ Đức Chung" });
    expect(result.missing).toEqual(["Ngày sinh", "Email"]);
    expect(result.values.monthlySalary).toBe(0);
    expect(result.defaulted).toContain("monthlySalary");
  });
  it("asks about lessons and quiz questions while defaulting the training instructor", () => {
    const training = defaultWorkflow(operationById("training.create")!);
    const basic = { title: "Lập trình PLC", category: "Văn hóa", duration: "30 ngày" };
    const partial = collectValues(training, basic);
    expect(partial.missing).toEqual([
      "Danh sách bài giảng (nếu chưa có, nói bỏ qua)",
      "Câu hỏi trắc nghiệm (nếu chưa có, nói bỏ qua)",
    ]);
    expect(partial.missing).not.toContain("Giảng viên");

    const complete = collectValues(training, {
      ...basic,
      instructor: "Nguyễn An",
      lessons: JSON.stringify([{ title: "Giới thiệu PLC", type: "text", content: "Các khái niệm cơ bản" }]),
      quizzes: JSON.stringify([{ question: "PLC dùng để làm gì?", options: ["Điều khiển tự động", "Soạn thảo văn bản"], correctOptionIndex: 0 }]),
    });
    expect(complete.missing).toEqual([]);
    expect(complete.errors).toEqual([]);

    const invalid = collectValues(training, {
      ...basic,
      lessons: JSON.stringify([{ title: "Bài thiếu nội dung", type: "text" }]),
      quizzes: JSON.stringify([{ question: "Câu hỏi", options: ["A", "B"], correctOptionIndex: 2 }]),
    });
    expect(invalid.errors).toEqual([
      "Bài giảng · Mục 1: cần đường dẫn hoặc nội dung.",
      "Câu hỏi trắc nghiệm · Mục 1: đáp án đúng phải trỏ tới một phương án có trong danh sách.",
    ]);
  });
  it("requires repair device name and condition before allowing a preview", () => {
    const repair = defaultWorkflow(operationById("api.post.79291125e27b1d36")!);
    const result = collectValues(repair, { customerId: "KH-ABC-000001", symptom: "Yêu cầu thay pin" });
    expect(result.missing).toEqual(["Thông tin thiết bị · Tên thiết bị", "Thông tin thiết bị · Tình trạng thiết bị"]);

    const partialDevice = collectValues(repair, {
      customerId: "KH-ABC-000001",
      symptom: "Yêu cầu thay pin",
      device: JSON.stringify({ name: "Điện thoại" }),
    });
    expect(partialDevice.missing).toEqual(["Thông tin thiết bị · Tình trạng thiết bị"]);
  });
  it("asks for commission-policy settings conditionally and labels every missing item in Vietnamese", () => {
    const policy = ASSISTANT_OPERATIONS.find(operation => operation.method === "POST" && operation.path === "/worker-management/partners/policies")!;
    const workflow = defaultWorkflow(policy);
    const partial = collectValues(workflow, {
      name: "Chính sách thử",
      effectiveFrom: "2026-11-04",
      settlementCycle: JSON.stringify({ type: "cutoff_day" }),
      official: JSON.stringify({ enabled: true }),
      seasonal: JSON.stringify({ enabled: false }),
    });
    expect(partial.missing).toEqual([
      "Chu kỳ đối soát · Ngày chốt đối soát",
      "Hoa hồng lao động chính thức · Số tháng tối đa",
      "Hoa hồng lao động chính thức · Các mốc hoa hồng",
    ]);
    expect(partial.missing.join(" ")).not.toMatch(/settlementCycle|official|seasonal|cutoffDay|maxMonths|milestones/);

    const valid = collectValues(workflow, {
      name: "Chính sách thời vụ",
      effectiveFrom: "2026-11-04",
      settlementCycle: JSON.stringify({ type: "calendar_month" }),
      official: JSON.stringify({ enabled: false }),
      seasonal: JSON.stringify({
        enabled: true,
        aggregationScope: "partner_period",
        tierMode: "flat",
        hourRounding: { unitMinutes: 5, mode: "nearest" },
        moneyRounding: { unitVnd: 1000, mode: "floor" },
        tiers: [{ minHours: 0, maxHours: null, hourlyRate: 1000 }],
      }),
    });
    expect(valid.missing).toEqual([]);
    expect(valid.errors).toEqual([]);
  });
  it("blocks invalid commission-policy combinations before showing a preview", () => {
    const policy = ASSISTANT_OPERATIONS.find(operation => operation.method === "POST" && operation.path === "/worker-management/partners/policies")!;
    const workflow = defaultWorkflow(policy);
    const bothDisabled = collectValues(workflow, {
      name: "Chính sách thử",
      effectiveFrom: "2026-11-04",
      effectiveTo: "2026-11-03",
      settlementCycle: JSON.stringify({ type: "calendar_month" }),
      official: JSON.stringify({ enabled: false }),
      seasonal: JSON.stringify({ enabled: false }),
    });
    expect(bothDisabled.errors).toEqual([
      "Ngày hiệu lực đến phải từ ngày áp dụng trở đi.",
      "Cần bật ít nhất một cơ chế: hoa hồng chính thức hoặc hoa hồng thời vụ.",
    ]);

    const invalidTiers = collectValues(workflow, {
      name: "Chính sách thử",
      effectiveFrom: "2026-11-04",
      settlementCycle: JSON.stringify({ type: "calendar_month" }),
      official: JSON.stringify({ enabled: true, maxMonths: 1, milestones: [{ month: 1, amount: 1000, eligibilityRule: "attendance_threshold" }] }),
      seasonal: JSON.stringify({
        enabled: true,
        aggregationScope: "partner_period",
        tierMode: "flat",
        hourRounding: { unitMinutes: 1, mode: "nearest" },
        moneyRounding: { unitVnd: 1, mode: "nearest" },
        tiers: [
          { minHours: 0, maxHours: 10, hourlyRate: 1000 },
          { minHours: 12, maxHours: 20, hourlyRate: 1200 },
        ],
      }),
    });
    expect(invalidTiers.errors).toEqual([
      "Các mốc hoa hồng · Mục 1: điều kiện chấm công cần có số ngày hoặc số giờ làm tối thiểu.",
      "Các bậc giờ phải liên tục, bắt đầu từ 0 hoặc ngưỡng giờ tối thiểu và không chồng lấn.",
      "Bậc giờ cuối không nhập giới hạn trên để áp dụng không giới hạn.",
    ]);
  });
  it("preserves explicit zero and uses personal field order and defaults", () => {
    const config = draft(); config.fields.reverse(); config.fields.find(f => f.key === "monthlySalary")!.defaultValue = 5000000;
    const workflow = validateWorkflow(employee, config);
    expect(collectValues(workflow, { monthlySalary: 0 }).values.monthlySalary).toBe(0);
    expect(collectValues(workflow, {}).values.monthlySalary).toBe(5000000);
    expect(collectValues(workflow, {}).missing).toEqual(["Email", "Ngày sinh", "Họ và tên"]);
  });
  it("never defaults a linked record and rejects workflow defaults for relationship fields", () => {
    const workflow = defaultWorkflow(employee);
    const department = workflow.fields.find(field => field.key === "department")!;
    department.defaultValue = "Kỹ thuật";
    const collected = collectValues(workflow, { displayName: "An", email: "an@example.test", birthDate: "1994-03-12" });
    expect(collected.values.department).toBeUndefined();
    expect(collected.defaulted).not.toContain("department");

    const config = draft(); config.fields.find(field => field.key === "department")!.defaultValue = "Kỹ thuật";
    expect(() => validateWorkflow(employee, config)).toThrow("phải được người dùng chọn");
  });
  it("also blocks workflow defaults on arrays that contain linked records", () => {
    const interview = operationById("recruitment.interview.create")!;
    const config = { ...defaultWorkflow(interview), fields: defaultWorkflow(interview).fields.map(field => ({ key: field.key, required: field.required, ...(field.key === "interviewerIds" ? { defaultValue: '["Nguyễn An"]' } : {}) })) };
    expect(() => validateWorkflow(interview, config)).toThrow("phải được người dùng chọn");

    const unsafeWorkflow: any = { ...defaultWorkflow(interview), fields: defaultWorkflow(interview).fields.map(field => field.key === "interviewerIds" ? { ...field, defaultValue: '["Nguyễn An"]' } : field) };
    const result = collectValues(unsafeWorkflow, {});
    expect(result.values.interviewerIds).toBeUndefined();
    expect(result.defaulted).not.toContain("interviewerIds");
  });
  it("rejects weakening hard requirements, invalid defaults and hidden authority fields", () => {
    const config = draft(); config.fields.find(f => f.key === "email")!.required = false;
    expect(() => validateWorkflow(employee, config)).toThrow("bắt buộc");
    const badSalary = draft(); badSalary.fields.find(f => f.key === "monthlySalary")!.defaultValue = -1;
    expect(() => validateWorkflow(employee, badSalary)).toThrow("Lương tháng");
    expect(collectValues(defaultWorkflow(employee), { role: "admin", companyCode: "OTHER", password: "secret" }).errors).toHaveLength(3);
    expect(() => validateWorkflow(employee, { ...draft(), fields: [] })).toThrow("giữ đủ");
  });
  it("rejects impossible dates, future birth dates, wrong primitive types and missing delete confirmation", () => {
    expect(collectValues(defaultWorkflow(employee), { birthDate: "2025-02-30", monthlySalary: "0" }).errors).toHaveLength(2);
    expect(collectValues(defaultWorkflow(employee), { birthDate: "2999-01-01" }).errors).toHaveLength(1);
    const op = operationById("project.delete")!; const workflow = defaultWorkflow(op);
    expect(() => validateWorkflow(op, { ...workflow, fields: workflow.fields.map(f => ({ key: f.key, required: true })), requireConfirmation: false })).toThrow("luôn cần xác nhận");
  });
});
