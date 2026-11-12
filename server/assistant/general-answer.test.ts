import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  openrouterChat: vi.fn(),
  searchCommonsImage: vi.fn(),
  extractFromSources: vi.fn<typeof import("./image-search").extractIllustrationsFromSources>(async () => []),
}));

vi.mock("../service/openrouter.service", () => ({
  openrouterChat: state.openrouterChat,
}));

vi.mock("./image-search", async () => {
  const actual = await vi.importActual<typeof import("./image-search")>("./image-search");
  return {
    ...actual,
    searchAssistantCommonsImage: state.searchCommonsImage,
    extractIllustrationsFromSources: (...args: Parameters<typeof actual.extractIllustrationsFromSources>) =>
      state.extractFromSources(...args),
  };
});

import { AssistantMessageContent } from "../../src/components/common/AssistantMessageContent";
import {
  answerAssistantGeneralQuestion,
  answerAssistantResearchQuestion,
  assistantImageSearchQuery,
  sanitizeResearchReplyAndSources,
} from "./general-answer";
import {
  extractImageSubjectQuery,
  extractSourcePageImageCandidates,
  isRelevantImageCandidate,
  isSafePublicWebUrl,
} from "./image-search";

describe("deep research image and link accuracy", () => {
  it("sends images attached to a chat question as vision input", async () => {
    state.openrouterChat.mockResolvedValueOnce({ text: "Trong ảnh có một chiếc xe đạp." });
    await answerAssistantGeneralQuestion({
      question: "Mô tả ảnh này",
      messages: [],
      visualAttachments: [{ fileName: "xe.png", dataUrl: "data:image/jpeg;base64,ZmFrZQ==" }],
    });

    const request = state.openrouterChat.mock.calls.at(-1)?.[0];
    expect(request!.messages.at(-1)).toEqual({
      role: "user",
      content: [
        { type: "text", text: expect.stringContaining("xe.png") },
        { type: "image_url", image_url: { url: "data:image/jpeg;base64,ZmFrZQ==" } },
      ],
    });
  });

  it("passes an uploaded table to chat as source data", async () => {
    state.openrouterChat.mockResolvedValueOnce({ text: "Bảng có một học viên." });
    const documentContext = {
      title: "danh_sach.csv",
      version: 1,
      content: { type: "uploaded-table", headers: ["Học viên"], rows: [["Minh"]] },
    };

    await answerAssistantResearchQuestion({
      question: "Tóm tắt tệp này",
      messages: [],
      documentContext,
      research: true,
    });

    const request = state.openrouterChat.mock.calls.at(-1)?.[0];
    expect(JSON.parse(request!.messages[1].content).sourceDocument).toEqual(documentContext);
  });

  it("does not misinterpret Vietnamese 'ai' (who) as Artificial Intelligence", () => {
    expect(assistantImageSearchQuery("Ai là người sáng lập tập đoàn Microsoft?")).toBe(
      "Ai là người sáng lập tập đoàn Microsoft?",
    );
    expect(extractImageSubjectQuery("Ai là người sáng lập tập đoàn Microsoft?")?.query).toBe(
      "người sáng lập tập đoàn Microsoft",
    );
    expect(assistantImageSearchQuery("Giải thích về AI tạo sinh hiện nay")).toBe("Trí tuệ nhân tạo");
  });

  it("skips stock illustrations for gold price, financial rate, coding, and comparison questions", () => {
    expect(extractImageSubjectQuery("Giá vàng SJC hôm nay bao nhiêu?")).toBeNull();
    expect(extractImageSubjectQuery("So sánh lãi suất ngân hàng tháng này")).toBeNull();
    expect(extractImageSubjectQuery("Viết đoạn mã Python sắp xếp mảng")).toBeNull();
  });

  it("verifies image candidate relevance against extracted subject tokens", () => {
    const subject = extractImageSubjectQuery("Cho mình xem hình ảnh Cầu Rồng Đà Nẵng");
    expect(subject).toEqual({
      query: "Cầu Rồng Đà Nẵng",
      tokens: ["cau", "rong", "da", "nang"],
      explicitImageRequest: true,
    });
    expect(
      isRelevantImageCandidate(
        "Cầu Rồng Đà Nẵng về đêm.jpg",
        "Cầu Rồng bắc qua sông Hàn tại Đà Nẵng",
        subject!.tokens,
        subject!.explicitImageRequest,
      ),
    ).toBe(true);
    expect(
      isRelevantImageCandidate(
        "Page1-Sach-lich-su-Viet-Nam.pdf",
        "Tài liệu lịch sử Đà Nẵng",
        subject!.tokens,
        subject!.explicitImageRequest,
      ),
    ).toBe(false);
    expect(
      isRelevantImageCandidate(
        "Cầu Long Biên Hà Nội.jpg",
        "Cây cầu lịch sử tại Hà Nội",
        subject!.tokens,
        subject!.explicitImageRequest,
      ),
    ).toBe(false);
  });

  it("strips hallucinated links and inline images while preserving verified URLs and Wikipedia parentheses", () => {
    const rawReply = [
      "Theo [VnExpress](https://vnexpress.net), kim loại vàng có ký hiệu hóa học Au ([Wikipedia](https://vi.wikipedia.org/wiki/Vàng_(nguyên_tố)?utm_source=openai)).",
      "Xem thêm tại [Báo bịa đặt](https://fake-news.example.com/bai-viet-khong-ton-tai) ([https://fake-news.example.com/123](https://fake-news.example.com/123)).",
      "![Ảnh bịa](https://fake-news.example.com/anh-sai.jpg)",
    ].join("\n");

    const sanitized = sanitizeResearchReplyAndSources(rawReply, [
      {
        title: "vi.wikipedia.org",
        url: "https://vi.wikipedia.org/wiki/Vàng_(nguyên_tố)?utm_source=openai",
      },
      {
        title: "Giá vàng hôm nay - VnExpress",
        url: "https://vnexpress.net/gia-vang-hom-nay-4812345.html?utm_source=openai",
      },
      {
        title: "Vàng (nguyên tố) – Wikipedia tiếng Việt",
        url: "https://vi.wikipedia.org/wiki/Vàng_(nguyên_tố)",
      },
    ]);

    expect(sanitized.reply).toContain("[VnExpress](https://vnexpress.net/gia-vang-hom-nay-4812345.html)");
    expect(sanitized.reply).toContain("[Wikipedia](https://vi.wikipedia.org/wiki/V%C3%A0ng_(nguy%C3%AAn_t%E1%BB%91))");
    expect(sanitized.reply).toContain("Xem thêm tại Báo bịa đặt.");
    expect(sanitized.reply).not.toContain("fake-news.example.com");
    expect(sanitized.sources).toEqual([
      {
        title: "Giá vàng hôm nay - VnExpress",
        url: "https://vnexpress.net/gia-vang-hom-nay-4812345.html",
      },
      {
        title: "Vàng (nguyên tố) – Wikipedia tiếng Việt",
        url: "https://vi.wikipedia.org/wiki/V%C3%A0ng_(nguy%C3%AAn_t%E1%BB%91)",
      },
    ]);

    const markup = renderToStaticMarkup(
      createElement(AssistantMessageContent, {
        content: sanitized.reply,
        allowedLinkUrls: sanitized.sources.map(source => source.url),
      }),
    );
    expect(markup).toContain('href="https://vnexpress.net/gia-vang-hom-nay-4812345.html"');
    expect(markup).toContain('href="https://vi.wikipedia.org/wiki/V%C3%A0ng_(nguy%C3%AAn_t%E1%BB%91)"');
    expect(markup).not.toContain("fake-news.example.com");
  });

  it("does not pollute research sources with Wikimedia Commons image links", async () => {
    state.openrouterChat.mockResolvedValueOnce({
      text: "Vịnh Hạ Long nằm ở tỉnh Quảng Ninh ([UNESCO](https://whc.unesco.org/en/list/672?utm_source=openai)).",
      citations: [
        {
          title: "Ha Long Bay - UNESCO World Heritage Centre",
          url: "https://whc.unesco.org/en/list/672?utm_source=openai",
        },
      ],
    });
    state.searchCommonsImage.mockResolvedValueOnce({
      illustration: {
        alt: "Ảnh minh họa: Vịnh Hạ Long",
        url: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=",
        sourceTitle: "Vịnh Hạ Long",
        sourceUrl: "https://vi.wikipedia.org/wiki/V%E1%BB%8Bnh_H%E1%BA%A1_Long",
        sourceCredit: "Nguồn: Wikipedia / Wikimedia Commons",
      },
      source: {
        title: "Vịnh Hạ Long",
        url: "https://vi.wikipedia.org/wiki/V%E1%BB%8Bnh_H%E1%BA%A1_Long",
      },
    });

    const result = await answerAssistantResearchQuestion({
      question: "Cho mình xem hình ảnh Vịnh Hạ Long",
      messages: [],
      research: true,
    });

    expect(result.sources).toEqual([
      {
        title: "Ha Long Bay - UNESCO World Heritage Centre",
        url: "https://whc.unesco.org/en/list/672",
      },
    ]);
    expect(result.illustrations).toHaveLength(1);
    expect(result.illustrations?.[0].sourceTitle).toBe("Vịnh Hạ Long");
  });

  it("extracts lead images directly from cited source HTML pages and prioritizes them as illustrations", async () => {
    const sampleHtml = `
      <!doctype html>
      <html>
        <head>
          <meta property="og:image" content="/uploads/2026/11/cau-rong-da-nang.jpg" />
          <meta property="og:image:alt" content="Toàn cảnh Cầu Rồng Đà Nẵng" />
          <meta name="twitter:image" content="https://baodanang.vn/assets/logo.png" />
        </head>
        <body>
          <article>
            <img src="https://baodanang.vn/uploads/2026/11/inline-photo.webp" width="800" height="500" alt="Ảnh trong bài" />
            <img src="https://baodanang.vn/assets/icon-share.svg" width="24" height="24" />
          </article>
        </body>
      </html>
    `;
    const candidates = extractSourcePageImageCandidates(sampleHtml, "https://baodanang.vn/du-lich/cau-rong-123.html");
    expect(candidates).toEqual([
      {
        url: "https://baodanang.vn/uploads/2026/11/cau-rong-da-nang.jpg",
        alt: "Toàn cảnh Cầu Rồng Đà Nẵng",
      },
      {
        url: "https://baodanang.vn/uploads/2026/11/inline-photo.webp",
        alt: "Ảnh trong bài",
      },
    ]);
    expect(isSafePublicWebUrl("http://127.0.0.1/secret.jpg")).toBeNull();
    expect(isSafePublicWebUrl("http://192.168.1.10/photo.jpg")).toBeNull();

    state.openrouterChat.mockResolvedValueOnce({
      text: "Cầu Rồng là điểm nhấn kiến trúc tại Đà Nẵng ([Báo Đà Nẵng](https://baodanang.vn/du-lich/cau-rong-123.html)).",
      citations: [
        {
          title: "Cầu Rồng Đà Nẵng - Báo Đà Nẵng",
          url: "https://baodanang.vn/du-lich/cau-rong-123.html",
        },
        {
          title: "Du lịch sông Hàn - VnExpress",
          url: "https://vnexpress.net/du-lich-song-han-456.html",
        },
      ],
    });
    state.extractFromSources.mockResolvedValueOnce([
      {
        alt: "Ảnh minh họa: Toàn cảnh Cầu Rồng Đà Nẵng",
        url: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=",
        sourceTitle: "Cầu Rồng Đà Nẵng - Báo Đà Nẵng",
        sourceUrl: "https://baodanang.vn/du-lich/cau-rong-123.html",
      },
      {
        alt: "Ảnh minh họa: Du lịch sông Hàn - VnExpress",
        url: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=",
        sourceTitle: "Du lịch sông Hàn - VnExpress",
        sourceUrl: "https://vnexpress.net/du-lich-song-han-456.html",
      },
    ]);

    const result = await answerAssistantResearchQuestion({
      question: "Giới thiệu về Cầu Rồng Đà Nẵng",
      messages: [],
      research: true,
    });

    expect(state.extractFromSources).toHaveBeenCalledWith(
      [
        {
          title: "Cầu Rồng Đà Nẵng - Báo Đà Nẵng",
          url: "https://baodanang.vn/du-lich/cau-rong-123.html",
        },
        {
          title: "Du lịch sông Hàn - VnExpress",
          url: "https://vnexpress.net/du-lich-song-han-456.html",
        },
      ],
      { maxSources: 5, maxIllustrations: 4 },
    );
    expect(result.illustrations).toHaveLength(2);
    expect(result.illustrations?.[0].sourceUrl).toBe("https://baodanang.vn/du-lich/cau-rong-123.html");
    expect(result.illustrations?.[1].sourceUrl).toBe("https://vnexpress.net/du-lich-song-han-456.html");
  });
});
