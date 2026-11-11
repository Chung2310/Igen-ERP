import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantMessageContent } from "./AssistantMessageContent";
import { assistantSourceKind } from "./assistant-link-utils";

describe("research answer links and media", () => {
  it("renders cited Markdown links and direct image URLs", () => {
    const rendered = renderToStaticMarkup(<AssistantMessageContent
      content="Read [the report](https://example.com/report.pdf), then see ![the chart](https://example.com/chart.png)."
      allowedLinkUrls={["https://example.com/report.pdf", "https://example.com/chart.png"]}
    />);

    expect(rendered).toContain('<a href="https://example.com/report.pdf"');
    expect(rendered).toContain('href="https://example.com/chart.png"');
    expect(rendered).toContain('<img src="https://example.com/chart.png" alt="the chart" loading="lazy"');
    expect(rendered).toContain('rel="noopener noreferrer"');
  });

  it("leaves uncited and unsafe Markdown URLs non-clickable", () => {
    const rendered = renderToStaticMarkup(<AssistantMessageContent
      content="[uncited](https://other.example/page) [unsafe](javascript:alert(1))"
      allowedLinkUrls={["https://example.com/page"]}
    />);

    expect(rendered).not.toContain("<a ");
    expect(rendered).toContain("uncited");
    expect(rendered).toContain("javascript:alert(1)");
  });

  it("classifies direct images and documents for the research source list", () => {
    expect(assistantSourceKind("https://example.com/chart.webp?size=large")).toBe("image");
    expect(assistantSourceKind("https://example.com/guide.pdf")).toBe("document");
    expect(assistantSourceKind("https://example.com/guide")).toBe("website");
  });

  it("renders Markdown comparisons as a semantic table with horizontal scrolling", () => {
    const content = [
      "Compare the common options:",
      "",
      "| Feature | Option A | Option B |",
      "| :--- | ---: | ---: |",
      "| Price | 100 | 150 |",
      "| Updated | Today | Yesterday |",
    ].join("\n");
    const rendered = renderToStaticMarkup(<AssistantMessageContent content={content} />);

    expect(rendered).toContain('<div role="region" aria-label="Bảng dữ liệu. Có thể cuộn ngang để xem đủ các cột."');
    expect(rendered).toContain('<table class="w-full min-w-max border-collapse text-sm tabular-nums text-on-surface">');
    expect(rendered).toContain('<th scope="col"');
    expect(rendered).toContain("Option A");
    expect(rendered).toContain("Option B");
    expect(rendered).toContain("Yesterday");
  });
});
