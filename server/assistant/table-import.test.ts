import { afterEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));

import { interpretRequest } from "./interpreter";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { mapAssistantTableAttachment } from "./table-import";
import { validateStructuredField } from "./structured-data";

afterEach(() => provider.mockReset());

describe("assistant bulk table import routing and column mapping", () => {
  const allWorkflows = ASSISTANT_OPERATIONS.map(defaultWorkflow);

  it.each([
    ["thêm học viên bằng danh sách trong file excel", "student.bulk.create"],
    ["Thêm danh sách từ tệp excel danh sach hoc vien cap nhat 20 nguoi", "student.bulk.create"],
    ["kiểm tra danh sách học viên từ file excel trước khi nhập", "student.bulk.preview"],
    ["thêm lao động bằng danh sách trong file excel", "worker.bulk.create"],
    ["tạo hàng loạt cộng tác viên giới thiệu học viên từ file excel", "partner.bulk.create"],
  ])("routes bulk/file creation intent directly to the bulk workflow: %s -> %s", async (text, expectedActionId) => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {} }) });

    const result = await interpretRequest(text, allWorkflows, null, []);

    expect(result.actionId).toBe(expectedActionId);
    expect(result.intentType).toBe("workflow");
  });

  it("keeps single-student creation routed to the single student create workflow", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {} }) });
    const singleStudentCreateOp = ASSISTANT_OPERATIONS.find(op => op.method === "POST" && op.path === "/students")!;

    const result = await interpretRequest("thêm học viên Nguyễn Văn An", allWorkflows, null, []);

    expect(result.actionId).toBe(singleStudentCreateOp.id);
  });

  it("maps Chờ nhập học as a supported student status", () => {
    const bulkOp = operationById("student.bulk.create")!;
    const mapped = mapAssistantTableAttachment(bulkOp, {
      fileName: "hoc-vien.xlsx",
      headers: ["Họ và tên", "Số điện thoại", "Email", "Trạng thái"],
      rows: [{ "Họ và tên": "Nguyễn Văn An", "Số điện thoại": "0900000000", Email: "an@example.com", "Trạng thái": "Chờ nhập học" }],
    });

    expect(mapped.rows[0]).toMatchObject({ fullName: "Nguyễn Văn An", status: "Chờ nhập học" });
  });

  it("reports the student, field, invalid value and allowed values for an unsupported status", () => {
    const studentsField = operationById("student.bulk.create")!.fields.find(field => field.key === "students")!;
    const students = [
      { fullName: "Nguyễn Văn An", phone: "0900000000", email: "an@example.com", status: "Đang học" },
      { fullName: "Trần Quốc Bảo", phone: "0900000001", email: "bao@example.com", status: "Đang học" },
      { fullName: "Lê Minh Châu", phone: "0900000002", email: "chau@example.com", status: "Chờ vào lớp" },
    ];

    expect(() => validateStructuredField(studentsField, JSON.stringify(students))).toThrow(
      /Mục 3 · Lê Minh Châu · Trạng thái học viên: giá trị “Chờ vào lớp” không hợp lệ\. Chọn một trong các giá trị:/,
    );
  });

  it("identifies placeholder phone data before the bulk request is confirmed", () => {
    const studentsField = operationById("student.bulk.create")!.fields.find(field => field.key === "students")!;
    const students = [{ fullName: "Nguyễn Văn An", phone: "SĐT giả lập 001", email: "an@example.com" }];

    expect(() => validateStructuredField(studentsField, JSON.stringify(students))).toThrow(
      /Mục 1 · Nguyễn Văn An · Số điện thoại: giá trị “SĐT giả lập 001” sai định dạng\./,
    );
  });

  it("identifies placeholder identity-card data with the learner and Excel row", () => {
    const studentsField = operationById("student.bulk.create")!.fields.find(field => field.key === "students")!;
    const students = [{ sourceRow: 2, fullName: "Nguyễn Minh Anh", phone: "0900000001", email: "anh@example.com", idCard: "CCCD giả lập 001" }];

    expect(() => validateStructuredField(studentsField, JSON.stringify(students))).toThrow(
      /Dòng Excel 2 · Nguyễn Minh Anh · CCCD\/CMND: giá trị “CCCD giả lập 001” sai định dạng\./,
    );
  });

  it("reports every invalid Excel row with its original row number and learner name", () => {
    const studentsField = operationById("student.bulk.create")!.fields.find(field => field.key === "students")!;
    const students = [
      { sourceRow: 2, fullName: "Nguyễn Minh Anh", phone: "SĐT giả lập 001", email: "anh@example.com" },
      { sourceRow: 3, fullName: "Trần Quốc Bảo", phone: "SĐT giả lập 002", email: "bao@example.com" },
    ];
    let message = "";
    try {
      validateStructuredField(studentsField, JSON.stringify(students));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("Dòng Excel 2 · Nguyễn Minh Anh · Số điện thoại");
    expect(message).toContain("Dòng Excel 3 · Trần Quốc Bảo · Số điện thoại");
  });

  it("maps standard ERP student Excel template columns and keeps the paid amount", () => {
    const bulkOp = operationById("student.bulk.create")!;
    const mapped = mapAssistantTableAttachment(bulkOp, {
      fileName: "danh_sach_hoc_vien_cap_nhat_20_nguoi.xlsx",
      headers: [
        "STT",
        "Họ và tên *",
        "Số điện thoại *",
        "Email *",
        "Hạng",
        "CCCD / CMND",
        "Ngày sinh",
        "Địa chỉ",
        "Học phí",
        "Đã đóng",
        "Còn nợ",
        "Trạng thái",
        "Người giới thiệu",
        "Lớp / Dự án",
        "Ngày đăng ký",
        "Ngày nhập học",
      ],
      rows: [
        {
          "STT": "1",
          "Họ và tên *": "Nguyễn Văn An",
          "Số điện thoại *": "987654321",
          "Email *": "an.nguyen@example.com",
          "Hạng": "B2",
          "CCCD / CMND": "001099001234",
          "Ngày sinh": "15/05/1999",
          "Địa chỉ": "Hà Nội",
          "Học phí": "15.000.000",
          "Đã đóng": "5.000.000",
          "Còn nợ": "10.000.000",
          "Trạng thái": "Đang học",
          "Người giới thiệu": "CTV Minh",
          "Lớp / Dự án": "K24-B2",
          "Ngày đăng ký": "01/11/2026",
          "Ngày nhập học": "05/11/2026",
        },
      ],
    });

    expect(mapped.fieldKey).toBe("students");
    expect(mapped.rowCount).toBe(1);
    expect(mapped.rows[0]).toEqual({
      sourceRow: 2,
      fullName: "Nguyễn Văn An",
      phone: "0987654321",
      email: "an.nguyen@example.com",
      rank: "B2",
      idCard: "001099001234",
      birthday: "1999-05-15",
      address: "Hà Nội",
      fee: 15000000,
      paidAmount: 5000000,
      status: "Đang học",
      referral: "CTV Minh",
      batchCode: "K24-B2",
      registrationDate: "2026-11-01",
      enrollmentDate: "2026-11-05",
    });
  });

  it("maps the attached learner workbook headers and retains payment amounts", () => {
    const bulkOp = operationById("student.bulk.create")!;
    const mapped = mapAssistantTableAttachment(bulkOp, {
      fileName: "danh_sach_hoc_vien_cap_nhat_20_nguoi.xlsx",
      headers: ["Họ và tên", "Số điện thoại", "Học phí", "Đã đóng", "Ngày đăng ký", "Trạng thái", "Lớp / Dự án", "Ngày sinh", "CCCD / CMND", "Email", "Người giới thiệu", "Địa chỉ", "Ngày nhập học"],
      rows: [{
        "Họ và tên": "Nguyễn Minh Anh",
        "Số điện thoại": "SĐT giả lập 001",
        "Học phí": "6.500.000",
        "Đã đóng": "3.000.000",
        "Ngày đăng ký": "12/11/2026",
        "Trạng thái": "Đang học",
        "Lớp / Dự án": "Lập trình Web K01",
        "Ngày sinh": "14/03/2002",
        "CCCD / CMND": "N/A - dữ liệu giả lập",
        "Email": "hocvien01@example.com",
        "Người giới thiệu": "Facebook",
        "Địa chỉ": "Cầu Giấy, Hà Nội",
        "Ngày nhập học": "15/11/2026",
      }],
    });

    expect(mapped.rows[0]).toEqual({
      sourceRow: 2,
      fullName: "Nguyễn Minh Anh",
      phone: "SĐT giả lập 001",
      fee: 6500000,
      paidAmount: 3000000,
      registrationDate: "2026-11-12",
      status: "Đang học",
      batchCode: "Lập trình Web K01",
      birthday: "2002-03-14",
      idCard: "N/A - dữ liệu giả lập",
      email: "hocvien01@example.com",
      referral: "Facebook",
      address: "Cầu Giấy, Hà Nội",
      enrollmentDate: "2026-11-15",
    });
  });
});
