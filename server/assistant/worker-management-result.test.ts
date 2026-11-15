import { expect, it } from "vitest";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import { operationById } from "./catalog";
import { formatFriendlyAssistantResult } from "./result-format";

it("shows useful Vietnamese fields when searching labor notifications", () => {
  const operation = operationById("worker.notification.list")!;
  expect(operation.resultFields).toContain("recipients");
  const reply = formatFriendlyAssistantResult(operation, [{
    title: "Kiểm tra an toàn",
    content: "Có mặt tại công trường lúc 8 giờ.",
    recipients: "all",
    recipientCount: 12,
    channels: ["in-app", "email"],
    status: "sent",
    createdAt: "2026-11-14T00:00:00.000Z",
  }]);

  const table = parseAssistantResultTable(reply);
  expect(table?.rows[0]?.values).toMatchObject({
    "Tiêu đề": "Kiểm tra an toàn",
    "Nội dung": "Có mặt tại công trường lúc 8 giờ.",
    "Phạm vi người nhận": "Tất cả người lao động",
    "Số người nhận": "12",
    "Kênh gửi": "Trong ứng dụng, Email",
    "Trạng thái": "Đã gửi",
  });
  expect(table?.rows[0]?.values["Ngày tạo"]).toContain("14/11/2026");
});

it("shows the matched worker and readable dates in labor contract results", () => {
  const operation = operationById("worker.labor.contract.list")!;
  const reply = formatFriendlyAssistantResult(operation, [{
    code: "LD-10", clientName: "Công ty Igen", workerName: "Lê Minh",
    startDate: "2026-01-01", endDate: "2026-12-31", status: "active", alertLevel: "expiring",
  }]);

  const row = parseAssistantResultTable(reply)?.rows[0]?.values;
  expect(row).toMatchObject({
    "Mã hợp đồng": "LD-10", "Khách hàng hoặc đơn vị sử dụng lao động": "Công ty Igen",
    "Người lao động": "Lê Minh", "Trạng thái": "Đang hoạt động", "Cảnh báo hạn hợp đồng": "Sắp hết hạn",
  });
  expect(row?.["Ngày bắt đầu"]).toContain("01/01/2026");
});

it("shows attendance records without internal IDs or raw status codes", () => {
  const operation = operationById("worker.attendance.list")!;
  const reply = formatFriendlyAssistantResult(operation, [{
    workerName: "Lê Minh", projectName: "Dự án lắp đặt", date: "2026-11-14",
    checkInAt: "2026-11-14T01:00:00.000Z", status: "missing-checkout", workedMinutes: 0,
  }]);

  const row = parseAssistantResultTable(reply)?.rows[0]?.values;
  expect(row).toMatchObject({
    "Người lao động": "Lê Minh", "Dự án": "Dự án lắp đặt", "Trạng thái": "Chưa ghi giờ ra",
  });
  expect(row?.["Giờ vào"]).toContain("08:00");
  expect(reply).not.toContain("workerId");
});
