import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantMessageContent } from "../../src/components/common/AssistantMessageContent";
import { formatAssistantResultTable } from "../../src/shared/assistant-result-table";
import { presentAssistantReply } from "./reply-presentation";

it("renders a natural single-result introduction, real table and optional question through the existing UI parser", () => {
  const reply = presentAssistantReply({ status: "completed", reply: formatAssistantResultTable("Mình đã tạo khách hàng.",
    [{ "Mã": "KH-QA-01", "Tên": "KHACH-HANG-QA", "Điện thoại": "0900000001" }],
    ["Bạn có muốn bổ sung không? Mình có thể thêm email hoặc địa chỉ. Bạn gửi thông tin cần thêm, hoặc nói “bỏ qua” nhé."]) });
  const markup = renderToStaticMarkup(<AssistantMessageContent content={reply.reply} />);
  expect(markup).toContain("Đã tạo khách hàng");
  expect(markup).toContain("<table");
  expect(markup).toContain("KH-QA-01");
  expect(markup).toContain("Bạn có muốn bổ sung không?");
  expect(markup).toContain("bỏ qua");
  expect(markup).not.toContain("1 kết quả");
});

it("renders cleaned prose and preserves a multi-row report table", () => {
  const reply = presentAssistantReply({ status: "completed", reply: formatAssistantResultTable("### **Học viên còn nợ**",
    [{ "Tên": "HOC-VIEN-QA-A", "Còn nợ": "2.000.000 ₫" }, { "Tên": "HOC-VIEN-QA-B", "Còn nợ": "3.000.000 ₫" }]) });
  const markup = renderToStaticMarkup(<AssistantMessageContent content={reply.reply} />);
  expect(markup).toContain("<table");
  expect(markup).toContain("2.000.000 ₫");
  expect(markup).toContain("3.000.000 ₫");
  expect(markup).not.toContain("###");
  expect(markup).not.toContain("**");
});
