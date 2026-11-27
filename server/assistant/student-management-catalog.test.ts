import { afterEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));

import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { projectRecords } from "./executor";
import { interpretRequest } from "./interpreter";
import { collectValues } from "./policy";

afterEach(() => provider.mockReset());

const requiredOperations = [
  "course.list", "course.detail", "course.create", "course.update", "course.delete", "course.category.list", "course.category.create", "course.category.delete",
  "batch.list", "student.batch.create", "student.batch.update", "student.batch.delete", "student.batch.enrollments.list",
  "student.batch.learner.add", "student.batch.learner.remove", "student.batch.enrollment.update", "batch.attendance.learners", "batch.attendance.record.update", "batch.attendance.delete", "student.schedule.list",
  "student.batch.progress-colors.list", "student.batch.progress-colors.update",
  "student.quality.thresholds.list", "student.quality.thresholds.update", "student.quality.list", "student.quality.mini-tests.list",
  "student.quality.assessment.update", "student.quality.mini-test.create", "student.quality.mini-test.update", "student.quality.mini-test.delete", "student.quality.assignment.grade",
  "student.list", "student.detail", "student.learning-history", "student.create", "student.update", "student.bulk.delete.preview", "student.bulk.delete",
  "student.payment.list", "student.payment.create", "student.payment.update", "student.payment.delete",
  "student.installments.list", "student.installment.create", "student.installment.update",
  "student.exam.list", "student.exam.create", "student.exam.update", "student.exam.delete", "student.exam.assign", "student.exam.unassign", "student.exam.grade-results.update", "student.exam.result.update",
  "student.resource.list", "student.resource.create", "student.resource.update", "student.resource.delete", "student.resource.category.list", "student.resource.category.create", "student.resource.category.delete", "student.resource.bookings.list", "student.resource.booking.create", "student.resource.booking.delete",
  "student.notification.list", "student.notification.create", "student.notification.update", "student.notification.delete",
  "student.learning-roadmap.list", "student.learning-roadmap.steps.list", "student.learning-roadmap.create", "student.learning-roadmap.update", "student.learning-roadmap.delete", "student.learning-roadmap.progression.list", "student.learning-roadmap.progression.update", "student.learning-roadmap.promote", "student.learning-roadmap.waitlist.list", "student.learning-roadmap.waitlist.place",
  "student.assignment.list", "student.assignment.create", "student.assignment.submissions.list", "student.assignment.grade",
];

function collectReferences(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [
    ...(typeof record.reference === "string" ? [record.reference] : []),
    ...Object.values(record).flatMap(collectReferences),
  ];
}

describe("student-management assistant catalog", () => {
  it.each([
    ["Ki\u1EC3m tra ch\u1EA5t l\u01B0\u1EE3ng h\u1ECDc vi\u00EAn", "student.quality.list", {}],
    ["Ki\u1EC3m tra ch\u1EA5t l\u01B0\u1EE3ng h\u1ECDc vi\u00EAn La V\u0103n S\u1EBFn", "student.quality.list", { query_search: "La V\u0103n S\u1EBFn" }],
    ["Th\u00F4ng tin h\u1ECDc ph\u00ED c\u1EE7a La V\u0103n S\u1EBFn", "student.list", { search: "La V\u0103n S\u1EBFn" }],
    ["L\u1ECBch s\u1EED \u0111\u00F3ng h\u1ECDc ph\u00ED c\u1EE7a La V\u0103n S\u1EBFn", "student.payment.list", { query_search: "La V\u0103n S\u1EBFn" }],
    ["T\u00ECm h\u1ECDc vi\u00EAn La V\u0103n S\u1EBFn", "student.list", { search: "La V\u0103n S\u1EBFn" }],
    ["Xem th\u00F4ng tin h\u1ECDc vi\u00EAn La V\u0103n S\u1EBFn", "student.detail", { path_id: "La V\u0103n S\u1EBFn" }],
    ["Danh s\u00E1ch h\u1ECDc vi\u00EAn", "student.list", {}],
    ["Danh s\u00E1ch kh\u00F3a h\u1ECDc", "course.list", {}],
    ["Danh s\u00E1ch l\u1EDBp h\u1ECDc", "batch.list", {}],
    ["Danh s\u00E1ch giao d\u1ECBch h\u1ECDc ph\u00ED", "student.payment.list", {}],
    ["Danh s\u00E1ch k\u1EF3 thi", "student.exam.list", {}],
    ["Danh s\u00E1ch th\u00F4ng b\u00E1o h\u1ECDc vi\u00EAn", "student.notification.list", {}],
    ["Danh s\u00E1ch ph\u00F2ng h\u1ECDc", "student.resource.list", {}],
    ["Danh sách thiết bị", "student.resource.list", { query_excludeType: "Phòng học" }],
    ["Danh s\u00E1ch l\u1ECBch h\u1ECDc", "student.schedule.list", {}],
    ["Danh s\u00E1ch b\u00E0i t\u1EADp", "student.assignment.list", {}],
    ["Danh s\u00E1ch t\u00ECnh tr\u1EA1ng n\u1ED9p b\u00E0i", "student.assignment.submissions.list", {}],
    ["Danh s\u00E1ch l\u1ED9 tr\u00ECnh h\u1ECDc", "student.learning-roadmap.list", {}],
  ])("understands a natural student request without a technical field name: %s", async (prompt, actionId, expectedValues) => {
    provider.mockRejectedValueOnce(new Error("A model call should not be needed for this clear student lookup."));
    const workflows = ASSISTANT_OPERATIONS.filter(item => item.module === "student").map(defaultWorkflow);

    const result = await interpretRequest(prompt, workflows, null, []);

    expect(result.actionId).toBe(actionId);
    expect(result.values).toEqual(expectedValues);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    ["Tạo lớp học LOP-A1, thuộc khóa học Tiếng Anh A1", "student.batch.create"],
    ["Sửa lớp học LOP-A1", "student.batch.update"],
    ["Xóa lớp học LOP-A1", "student.batch.delete"],
  ])("routes class requests to the class workflow instead of confusing them with a course: %s", async (prompt, actionId) => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: "course.create", values: {} }) });
    const workflows = ASSISTANT_OPERATIONS.filter(item => item.module === "student").map(defaultWorkflow);

    const result = await interpretRequest(prompt, workflows, null, []);

    expect(result.actionId).toBe(actionId);
    expect(provider).toHaveBeenCalledOnce();
  });

  it("keeps an explicit course request on the course workflow", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: "student.batch.create", values: {} }) });
    const workflows = ASSISTANT_OPERATIONS.filter(item => item.module === "student").map(defaultWorkflow);

    const result = await interpretRequest("Tạo khóa học Tiếng Anh A1 cho học viên", workflows, null, []);

    expect(result.actionId).toBe("course.create");
  });

  it("exposes the required list and write operations for every main tab", () => {
    for (const id of requiredOperations) expect(operationById(id), id).toBeDefined();
    for (const operation of ASSISTANT_OPERATIONS.filter(item => requiredOperations.includes(item.id))) {
      if (["POST", "PATCH", "PUT", "DELETE"].includes(operation.method) && !operation.id.endsWith(".preview")) expect(operation.confirmation, operation.id).toBe(true);
    }
  });

  it("keeps all student-management references connected to known operations", () => {
    const studentOperations = ASSISTANT_OPERATIONS.filter(item => item.module === "student");
    for (const operation of studentOperations) {
      for (const reference of collectReferences(operation.fields)) expect(operationById(reference), `${operation.id} -> ${reference}`).toBeDefined();
    }
    expect(operationById("student.resource.booking.delete")?.fields.find(field => field.key === "path_bookingId")?.reference).toBe("student.resource.bookings.list");
    expect(operationById("student.quality.assignment.grade")?.fields.find(field => field.key === "path_assignmentId")?.reference).toBe("student.assignment.list");
  });

  it("accepts student names and search aliases through supported fields", () => {
    const paymentSearch = collectValues(defaultWorkflow(operationById("student.payment.list")!), { studentName: "La V\u0103n S\u1EBFn" });
    expect(paymentSearch.errors).toEqual([]);
    expect(paymentSearch.values.query_search).toBe("La V\u0103n S\u1EBFn");

    const qualitySearch = collectValues(defaultWorkflow(operationById("student.quality.list")!), { search: "La V\u0103n S\u1EBFn" });
    expect(qualitySearch.errors).toEqual([]);
    expect(qualitySearch.values.query_search).toBe("La V\u0103n S\u1EBFn");

    const studentSearch = collectValues(defaultWorkflow(operationById("student.list")!), { query_search: "La V\u0103n S\u1EBFn" });
    expect(studentSearch.errors).toEqual([]);
    expect(studentSearch.values.search).toBe("La V\u0103n S\u1EBFn");

    const profileLookup = collectValues(defaultWorkflow(operationById("student.detail")!), { studentName: "La V\u0103n S\u1EBFn" });
    expect(profileLookup.errors).toEqual([]);
    expect(profileLookup.values.path_id).toBe("La V\u0103n S\u1EBFn");
  });

  it("resolves enrollment lifecycle edits to the enrollment record while keeping internal fields private", () => {
    const update = operationById("student.batch.enrollment.update")!;
    const studentField = update.fields.find(field => field.source === "path" && field.apiKey === "studentId");
    expect(studentField?.reference).toBe("student.batch.enrollments.list");
    expect(studentField?.referenceParentKey).toBe("path_id");
    expect(studentField?.referenceValueKey).toBe("studentId");

    const enrollmentList = operationById("student.batch.enrollments.list")!;
    const [record] = projectRecords(enrollmentList, { data: { enrollments: [{
      _id: "64b000000000000000000001", studentId: "64b000000000000000000002", __v: 4,
      studentName: "Nguyễn An", studentPhone: "0900000000", status: "Đang học",
    }] } }, { user: { companyCode: "company", branchId: "branch" } } as any);
    expect(record.studentId).toBe("64b000000000000000000002");
    expect((record as any).__assistantRefVersion).toBe(4);
    expect(Object.keys(record)).not.toContain("studentId");
    expect(JSON.stringify(record)).not.toContain("64b000000000000000000002");
  });

  it("projects class capacity and teacher while keeping learner IDs private", () => {
    const batchList = operationById("batch.list")!;
    expect(batchList.resultFields).toContain("instructorName");
    expect(batchList.resultFields).toContain("maxLearners");
    expect(batchList.resultFields).toContain("enrolledCount");
    expect(batchList.resultFields).toContain("remainingSlots");

    const [record] = projectRecords(batchList, { data: { batches: [{
      _id: "64b000000000000000000101", code: "CLASS-A", name: "Lớp A", instructorName: "Cô An",
      maxLearners: 18, enrolledCount: 1, remainingSlots: 17, learnerIds: ["64b000000000000000000201"],
    }] } }, { user: { companyCode: "company", branchId: "branch" } } as any);

    expect(record).toMatchObject({ code: "CLASS-A", instructorName: "Cô An", maxLearners: 18, enrolledCount: 1, remainingSlots: 17 });
    expect(record).not.toHaveProperty("learnerIds");
  });

  it("does not expose enrollment history before nested result filtering is supported", () => {
    const enrollmentList = operationById("student.batch.enrollments.list")!;
    expect(enrollmentList.resultFields).not.toContain("history");
  });

  it("keeps financial and notification edits within their safe contract", () => {
    const paymentUpdate = operationById("student.payment.update")!;
    expect(paymentUpdate.systemBodyFields).toContain("expectedVersion");
    expect(paymentUpdate.fields.some(field => field.source === "body" && field.apiKey === "amount")).toBe(false);

    const notificationCreate = operationById("student.notification.create")!;
    expect(notificationCreate.fields.some(field => field.apiKey === "studentIds" || field.apiKey === "installmentPlan")).toBe(false);
    expect(notificationCreate.description).toContain("không gửi email");
  });

  it.each([
    ["Sửa ghi chú giao dịch học phí của Nguyễn An", "student.payment.update"],
    ["Xóa phòng học P101", "student.resource.delete"],
    ["Tạo thiết bị máy chiếu MC01", "student.resource.create"],
    ["Cập nhật thiết bị máy chiếu MC01", "student.resource.update"],
    ["Xóa thiết bị máy chiếu MC01", "student.resource.delete"],
    ["Cập nhật đánh giá học viên trong lớp K01", "student.quality.assessment.update"],
  ])("routes a Vietnamese request to the intended student workflow: %s", async (prompt, operationId) => {
    const workflow = defaultWorkflow(operationById(operationId)!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: operationId, values: {} }) });

    const result = await interpretRequest(prompt, [workflow], null, []);

    expect(result.actionId).toBe(operationId);
  });

  it.each([
    ["Thông tin học phí của La Văn Sến", "student.list", { search: "La Văn Sến" }],
    ["Kiểm tra chất lượng học viên", "student.quality.list", {}],
    ["Xem danh sách thông báo học viên", "student.notification.list", {}],
    ["Sửa ngưỡng đánh giá chất lượng học viên", "student.quality.thresholds.update", {}],
    ["Xem trước ảnh hưởng khi xóa học viên La Văn Sến", "student.bulk.delete.preview", {}],
  ])("routes a real student-tab phrase to the correct operation: %s", async (prompt, operationId, expectedValues) => {
    const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "student").map(defaultWorkflow);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: expectedValues }) });
    const result = await interpretRequest(prompt, workflows, null, []);

    expect(result).toMatchObject({ actionId: operationId, values: expectedValues });
  });

  it.each([
    ["Thêm học phí cho học viên ABC 5 triệu", "student.installment.create", { path_id: "ABC", amountDue: 5_000_000 }],
    ["Sửa đợt học phí số 2 của học viên ABC thành 4 triệu", "student.installment.update", { path_id: "ABC", path_no: "2", amountDue: 4_000_000 }],
    ["Cập nhật tổng học phí dự kiến của học viên ABC thành 5 triệu", "student.update", { path_id: "ABC", fee: "5000000" }],
  ])("routes a tuition mutation to the matching write workflow: %s", async (prompt, actionId, values) => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId, values }) });
    const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "student").map(defaultWorkflow);

    const result = await interpretRequest(prompt, workflows, null, []);

    expect(result).toMatchObject({ actionId, values });
    expect(provider).toHaveBeenCalledOnce();
    const systemMessage = String(provider.mock.calls[0]?.[0]?.messages?.[0]?.content || "");
    expect(systemMessage).toContain(operationById(actionId!)!.title);
    expect(systemMessage).not.toContain('"title":"Tra cứu học viên"');
  });

  it.each([
    ["Thêm hồ sơ học viên Nguyễn An", "student.create"],
    ["Sửa hồ sơ học viên Nguyễn An", "student.update"],
    ["Xóa hồ sơ học viên Nguyễn An", "student.bulk.delete"],
  ])("routes student profile CRUD requests to the intended workflow: %s", async (prompt, operationId) => {
    const workflow = defaultWorkflow(operationById(operationId)!);
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: operationId, values: {} }) });

    const result = await interpretRequest(prompt, [workflow], null, []);

    expect(result.actionId).toBe(operationId);
  });
});
