import { beforeEach, expect, it, vi } from "vitest";
import { generateReplyCompletion } from "./ai-reply-provider";
import { readLeadDocument } from "./lead-contract-ocr";
import { findSubscriberField } from "./telecom-invoice-profile";
import type { LeadIntakeField } from "../../../../../shared/marketing-suite/lead-intake";

vi.mock("./ai-reply-provider", () => ({ generateReplyCompletion: vi.fn() }));

const fields: LeadIntakeField[] = [
  { key: "account", label: "Account", question: "Account thuê bao chính?", type: "text" },
  { key: "name", label: "Họ tên", question: "Tên khách?", type: "text" },
  { key: "phone", label: "Số điện thoại", question: "Số khách?", type: "phone" },
  { key: "appointment", label: "Ngày hẹn khách", question: "Ngày hẹn?", type: "date" },
  { key: "password", label: "Mật khẩu", question: "Mật khẩu?", type: "text" },
];
beforeEach(() => vi.resetAllMocks());

it.each([
  ["array", ["Truyen hinh co ban", "Tra truoc Internet Recare"]],
  ["line breaks", "Truyen hinh co ban\nTra truoc Internet Recare"],
  ["semicolons", "Truyen hinh co ban; Tra truoc Internet Recare"],
])("keeps both services from %s OCR output instead of flattening them into one service", async (_shape, text) => {
  const customerFields: LeadIntakeField[] = [
    { key: "services_custom", label: "Dịch vụ", type: "long_text", question: "Dịch vụ?" },
    { key: "address", label: "Địa chỉ", type: "long_text", question: "Địa chỉ?" },
  ];
  vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ kind: "document", fields: {
    services_custom: { status: "readable", text },
    address: { status: "readable", text: "Green Pearl\nBắc Ninh" },
  } }) } as never);
  expect(await readLeadDocument("data:image/png;base64,fixture", customerFields, undefined, Date.now() + 60_000, "telecom"))
    .toEqual({ other: false, values: { services_custom: "Truyen hinh co ban; Tra truoc Internet Recare", address: "Green Pearl Bắc Ninh" } });
  expect(String(vi.mocked(generateReplyCompletion).mock.calls[0][0].messages[0].content)).toContain("mỗi phần tử là đúng một dịch vụ");
});

it("does not turn malformed service objects or lists for single-value fields into Lead text", async () => {
  vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ kind: "document", fields: {
    dich_vu: { status: "readable", text: ["Internet", { text: "Truyền hình" }] },
    name: { status: "readable", text: ["A", "B"] },
  } }) } as never);
  expect(await readLeadDocument("data:image/png;base64,fixture", [
    ...fields, { key: "dich_vu", label: "Dịch vụ", type: "long_text", question: "Dịch vụ?" },
  ], undefined, Date.now() + 60_000, "telecom")).toEqual({ other: false, values: {} });
});

it("only accepts configured readable values and excludes credentials even if returned by the model", async () => {
  vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ kind: "document", fields: {
    account: { status: "readable", text: "bnh_gftth_thuyltt4" },
    name: { status: "readable", text: "LÊ THỊ THU THỦY" },
    phone: { status: "readable", text: "0869901418" },
    appointment: { status: "readable", text: "31/10/2026" },
    password: { status: "readable", text: "excluded-secret" },
    technician: { status: "readable", text: "Nhân viên xử lý" },
  } }) } as never);
  expect(await readLeadDocument("data:image/png;base64,fixture", fields, undefined, Date.now() + 60_000, "telecom")).toEqual({
    other: false, values: { account: "bnh_gftth_thuyltt4", name: "LÊ THỊ THU THỦY", phone: "0869901418", appointment: "2026-10-31" },
  });
  const request = vi.mocked(generateReplyCompletion).mock.calls[0][0];
  expect(request.operation).toBe("lead_document_ocr");
  const instructions = String(request.messages[0].content);
  expect(instructions).toContain("Mô tả công việc");
  expect(instructions).toContain("không phải khách");
  expect(instructions).toContain("không tự trở thành số điện thoại khách");
  expect(instructions).toContain("không phải ngày sinh");
  expect(instructions).not.toContain('"key":"password"');
});

it("does not put telecom-specific rules into the default OCR prompt even with an Account column", async () => {
  vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ kind: "document", fields: {
    account: { status: "readable", text: "client-account" },
  } }) } as never);
  await readLeadDocument("data:image/png;base64,fixture", fields, undefined, Date.now() + 60_000);
  const instructions = String(vi.mocked(generateReplyCompletion).mock.calls[0][0].messages[0].content);
  expect(instructions).not.toContain("Với ảnh nghiệp vụ viễn thông");
  expect(instructions).not.toContain("Trong khối Mô tả công việc");
});

it("does not invent customer details for infrastructure or choose an ambiguous subscriber account", async () => {
  vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ kind: "document", fields: {
    account: { status: "unclear", text: "account_1, account_2" },
    name: { status: "missing", text: "" }, phone: { status: "missing", text: "" },
  } }) } as never);
  expect(await readLeadDocument("data:image/png;base64,fixture", fields, undefined, Date.now() + 60_000))
    .toEqual({ other: false, values: {} });
});

it("recognizes a single configured Account or Thuê bao column without an extra OCR mapping", () => {
  expect(findSubscriberField(fields)?.key).toBe("account");
  expect(findSubscriberField([{ key: "id", label: "Thuê bao", question: "Mã?" }])?.key).toBe("id");
  expect(findSubscriberField([...fields, { key: "subscriber", label: "Mã thuê bao", question: "Mã?" }])).toBeUndefined();
});
