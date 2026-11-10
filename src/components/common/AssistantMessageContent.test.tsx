import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantMessageContent } from "./AssistantMessageContent";
import { ASSISTANT_OPERATIONS } from "../../../server/assistant/catalog";
import { formatHealthcareResult } from "../../../server/assistant/healthcare-result";

describe("AssistantMessageContent progressive display", () => {
  it("reveals plain replies without changing their saved content", () => {
    const content = "Xin chào, mình có thể hỗ trợ bạn.";
    const partial = renderToStaticMarkup(<AssistantMessageContent content={content} visibleCharacters={8} />);
    const complete = renderToStaticMarkup(<AssistantMessageContent content={content} />);

    expect(partial).toContain("Xin chào");
    expect(partial).not.toContain("hỗ trợ");
    expect(complete).toContain("hỗ trợ bạn");
  });

  it("keeps structured results as a table while revealing rows", () => {
    const content = [
      "Mình tìm thấy 2 kết quả phù hợp cho bạn.",
      "1. Tên: An · Mã: A01",
      "2. Tên: Bình · Mã: B02",
    ].join("\n");
    const partial = renderToStaticMarkup(<AssistantMessageContent content={content} visibleCharacters={Math.ceil(content.length * 0.75)} />);
    const complete = renderToStaticMarkup(<AssistantMessageContent content={content} />);

    expect(partial).toContain("<table");
    expect(partial).toContain("An");
    expect(partial).not.toContain("Bình");
    expect(complete).toContain("Bình");
  });

  it("renders a one-result lookup as a table, including results with one field", () => {
    const content = [
      "Mình tìm thấy một kết quả phù hợp cho bạn.",
      "1. Trạng thái: Đang mở",
    ].join("\n");
    const rendered = renderToStaticMarkup(<AssistantMessageContent content={content} />);

    expect(rendered).toContain("<table");
    expect(rendered).toMatch(/<th[^>]*>Trạng thái<\/th>/);
    expect(rendered).toMatch(/<td[^>]*>Đang mở<\/td>/);
  });

  it("keeps unlabelled result rows in a single-column table", () => {
    const content = [
      "Mình tìm thấy 2 kết quả phù hợp cho bạn.",
      "1. Vị trí tuyển dụng IOT",
      "2. Vị trí tuyển dụng QA",
    ].join("\n");
    const rendered = renderToStaticMarkup(<AssistantMessageContent content={content} />);

    expect(rendered).toContain("<table");
    expect(rendered).toContain("Thông tin");
    expect(rendered).toContain("Vị trí tuyển dụng IOT");
    expect(rendered).toContain("Vị trí tuyển dụng QA");
  });

  it("recognizes raw result summaries from module formatters", () => {
    const content = [
      "Tra cứu vị trí tuyển dụng · 1 kết quả:",
      "1. Mã: IT_IOT · Tiêu đề: Tuyển dụng nhân sự IOT",
    ].join("\n");
    const rendered = renderToStaticMarkup(<AssistantMessageContent content={content} />);

    expect(rendered).toContain("<table");
    expect(rendered).toContain("IT_IOT");
    expect(rendered).toContain("Tuyển dụng nhân sự IOT");
  });

  it.each(["create", "update", "detail", "list"])("renders actual healthcare patient %s results as a table with optional fields", action => {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === `healthcare.patient.${action}`)!;
    const result = formatHealthcareResult(operation, { items: [{ code: "BN-001", name: "Nguyễn An", phone: "", dateOfBirth: "", address: "", note: "" }] });
    const question = "Mình thấy các thông tin tùy chọn còn trống: Số điện thoại, Ngày sinh, Địa chỉ, Ghi chú. Bạn có muốn bổ sung không?";
    const rendered = renderToStaticMarkup(<AssistantMessageContent content={`${result}\n${question}`} />);
    expect(rendered).toContain("<table");
    for (const label of ["Mã bệnh nhân", "Họ tên bệnh nhân", "Số điện thoại", "Ngày sinh", "Địa chỉ", "Ghi chú"]) expect(rendered).toContain(label);
    expect(rendered).toContain("Nguyễn An");
    expect(rendered).toMatch(/<td[^>]*>—<\/td>/);
    expect(rendered).toContain("Bạn có muốn bổ sung không?");
    expect(rendered.indexOf("Bạn có muốn bổ sung không?")).toBeGreaterThan(rendered.indexOf("</table>"));
  });

  it("shows an existing module's successful update in the shared table", () => {
    const content = [
      "Xong rồi bạn nhé, mình đã cập nhật vị trí tuyển dụng.",
      "Mã vị trí tuyển dụng: IT_IOT",
      "Tiêu đề: tuyển dụng nhân sự IOT",
      "Phòng ban tuyển dụng: Phòng IT",
      "Hạn nhận hồ sơ: 30/11/2026",
    ].join("\n");
    const rendered = renderToStaticMarkup(<AssistantMessageContent content={content} />);

    expect(rendered).toContain("<table");
    expect(rendered).toMatch(/<th[^>]*>Mã vị trí tuyển dụng<\/th>/);
    expect(rendered).toMatch(/<td[^>]*>IT_IOT<\/td>/);
    expect(rendered).toContain("30/11/2026");
  });

  it("renders a future module's labelled rows without requiring a familiar result summary", () => {
    const rendered = renderToStaticMarkup(<AssistantMessageContent content={"Đã nhận phiếu nghiệp vụ mới.\n1. Mã phiếu: FUTURE-001 · Trạng thái: Đã lưu"} />);
    expect(rendered).toContain("<table");
    expect(rendered).toContain('aria-label="Kết quả"');
    expect(rendered).toContain("FUTURE-001");
  });

  it("keeps an unfinished success message as plain text while it is being revealed", () => {
    const content = "Xong rồi bạn nhé, mình đã cập nhật vị trí tuyển dụng.\nMã vị trí tuyển dụng: IT_IOT";
    const partial = renderToStaticMarkup(<AssistantMessageContent content={content} visibleCharacters={20} />);

    expect(partial).not.toContain("<section");
    expect(partial).toContain("Xong rồi bạn nhé");
  });
});
