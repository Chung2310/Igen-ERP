import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantMessageContent } from "./AssistantMessageContent";

describe("AssistantMessageContent progressive display", () => {
  it("renders markdown headings, emphasis, and list markers as simple formatting", () => {
    const markup = renderToStaticMarkup(<AssistantMessageContent content={[
      "### Thông tin học viên",
      "",
      "* Học viên **An**",
      "- Mã: 01",
      "",
      "Ghi chú *quan trọng*.",
    ].join("\n")} />);

    expect(markup).toMatch(/<h[3-6] /);
    expect(markup).toContain("<li");
    expect(markup).toContain("<strong>An</strong>");
    expect(markup).toContain("<em>quan trọng</em>");
    expect(markup).not.toContain("* Học viên");
    expect(markup).not.toContain("- Mã");
    expect(markup).not.toContain("*quan trọng*");
  });

  it("reveals plain replies without changing their saved content", () => {
    const content = "Xin chào, mình có thể hỗ trợ bạn.";
    const partial = renderToStaticMarkup(<AssistantMessageContent content={content} visibleCharacters={8} />);
    const complete = renderToStaticMarkup(<AssistantMessageContent content={content} />);

    expect(partial).toContain("Xin chào");
    expect(partial).not.toContain("hỗ trợ");
    expect(complete).toContain("hỗ trợ bạn");
  });

  it("places a sourced illustration after the paragraph that cites its source", () => {
    const content = [
      "Cầu Rồng là một điểm tham quan nổi bật ([nguồn](https://example.com/dragon-bridge)).",
      "Cầu phun lửa vào cuối tuần.",
    ].join("\n\n");
    const markup = renderToStaticMarkup(<AssistantMessageContent
      content={content}
      illustrations={[{
        alt: "Cầu Rồng nhìn từ xa",
        url: "https://images.example.com/dragon-bridge.jpg",
        sourceTitle: "Cầu Rồng Đà Nẵng",
        sourceUrl: "https://example.com/dragon-bridge?utm_source=search",
      }]}
    />);

    const citedParagraph = markup.indexOf("Cầu Rồng là một điểm tham quan nổi bật");
    const figure = markup.indexOf("<figure");
    const nextParagraph = markup.indexOf("Cầu phun lửa vào cuối tuần.");
    expect(citedParagraph).toBeGreaterThanOrEqual(0);
    expect(figure).toBeGreaterThan(citedParagraph);
    expect(nextParagraph).toBeGreaterThan(figure);
    expect(markup).toContain('alt="Cầu Rồng nhìn từ xa"');
    expect(markup).toContain("Cầu Rồng Đà Nẵng");
  });

  it("labels generated illustrations when the provider returns a hosted image URL", () => {
    const markup = renderToStaticMarkup(<AssistantMessageContent
      content="Đây là bản xem trước mình vừa tạo."
      illustrations={[{
        alt: "Logo quán cà phê",
        url: "https://images.example.com/coffee-logo.webp",
        generatedByAi: true,
      }]}
    />);

    expect(markup).toContain("Hình minh họa được tạo bằng AI.");
    expect(markup).toContain('alt="Logo quán cà phê"');
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
});
