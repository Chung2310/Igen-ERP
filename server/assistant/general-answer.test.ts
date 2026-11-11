import { afterEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
const commonsImageSearch = vi.hoisted(() => vi.fn().mockResolvedValue(null));
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
vi.mock("./image-search", () => ({ searchAssistantCommonsImage: commonsImageSearch }));

import { answerAssistantGeneralQuestion, answerAssistantResearchQuestion, assistantConversationContext } from "./general-answer";

afterEach(() => { provider.mockReset(); commonsImageSearch.mockReset(); commonsImageSearch.mockResolvedValue(null); });

describe("assistant general answers", () => {
  it("keeps earlier conversation details and complete messages within a bounded context", () => {
    const messages = Array.from({ length: 14 }, (_, index) => ({ role: index % 2 ? "assistant" as const : "user" as const, content: index === 0 ? "Mục tiêu: kế hoạch cho lớp IELTS." : `Tin ${index}` }));
    expect(assistantConversationContext(messages)[0].content).toContain("IELTS");
    const context = assistantConversationContext([{ role: "user", content: "a".repeat(20000) }, { role: "assistant", content: "b".repeat(10000) }]);
    expect(context.reduce((sum, item) => sum + item.content.length, 0)).toBe(24000);
    expect(context.at(-1)?.content).toHaveLength(10000);
  });
  it("answers in the requested conversation context without claiming ERP access", async () => {
    provider.mockResolvedValueOnce({ text: "Phòng ban là một nhóm nhân sự được tổ chức theo chuyên môn hoặc chức năng." });
    const reply = await answerAssistantGeneralQuestion({
      question: "Phòng ban là gì?",
      messages: [{ role: "user", content: "Mình đang tìm hiểu về tổ chức doanh nghiệp." }],
      instructions: "Trả lời ngắn gọn và thân thiện.",
      memories: ["Người dùng thích câu trả lời ngắn gọn."],
      sessionMemory: "Đang tìm hiểu cách tổ chức nhân sự.",
    });
    expect(reply).toContain("nhóm nhân sự");
    const request = provider.mock.calls[0][0];
    expect(request.messages[0].content).toContain("không có quyền truy cập dữ liệu tài khoản");
    expect(request.messages.at(-1)).toEqual({ role: "user", content: "Phòng ban là gì?" });
    expect(request.messages[1].content).toContain("Trả lời ngắn gọn và thân thiện.");
  });

  it("uses bounded multi-step web search and returns provider citations for deep research", async () => {
    const sources = [
      { title: "Official research", url: "https://example.com/research" },
      { title: "Independent review", url: "https://example.org/review" },
    ];
    provider.mockResolvedValueOnce({ text: "Kết quả nghiên cứu có trích dẫn [nguồn](https://example.com/research).", citations: sources });

    const result = await answerAssistantResearchQuestion({ question: "So sánh các bằng chứng về chủ đề này", messages: [] });

    expect(result).toEqual({ reply: "Kết quả nghiên cứu có trích dẫn [nguồn](https://example.com/research).", sources });
    expect(provider.mock.calls[0][0]).toMatchObject({ webSearch: true, maxRetries: 1 });
    expect(provider.mock.calls[0][0].messages[0].content).toContain("multiple angles and independent sources");
    expect(provider.mock.calls[0][0].messages.at(-1)).toEqual({ role: "user", content: "So sánh các bằng chứng về chủ đề này" });
  });

  it("searches current Vietnamese gold prices for common products without asking the user to choose", async () => {
    provider.mockResolvedValueOnce({ text: "Giá vàng được tổng hợp theo các nguồn mới nhất.", citations: [{ title: "Bảng giá vàng", url: "https://example.com/gold" }] });

    const result = await answerAssistantResearchQuestion({ question: "Giá vàng hôm nay", messages: [] }, "gold-prices");

    expect(result.sources?.[0].url).toBe("https://example.com/gold");
    const request = provider.mock.calls[0][0];
    expect(request.webSearch).toBe(true);
    expect(request.messages[0].content).toContain("vàng miếng SJC và vàng nhẫn tròn 9999");
    expect(request.messages[0].content).toContain("không hỏi người dùng chọn loại vàng");
    expect(request.messages[0].content).toMatch(/Thời điểm hiện tại ở Việt Nam: \d{2}:\d{2}/);
  });

  it("requires web search and citations for general information questions", async () => {
    provider.mockResolvedValueOnce({ text: "AI học mẫu từ dữ liệu. [Nguồn](https://example.com/ai).", citations: [
      { title: "AI", url: "https://example.com/ai" },
      { title: "Sơ đồ mạng neural", url: "https://example.com/neural-network.png" },
    ] });

    const result = await answerAssistantResearchQuestion({ question: "AI là gì?", messages: [] }, "information");

    const request = provider.mock.calls[0][0];
    expect(request.webSearch).toBe(true);
    expect(request.webSearchMode).toBe("deep");
    expect(request.messages[0].content).toContain("mọi câu hỏi tìm hiểu thông tin");
    expect(request.messages[0].content).toContain("trả lời các cách hiểu phổ biến thay vì hỏi người dùng");
    expect(request.messages[0].content).toContain("bắt buộc trình bày bằng bảng Markdown");
    expect(result.illustrations).toEqual([{
      alt: "Sơ đồ mạng neural",
      url: "https://example.com/neural-network.png",
      sourceTitle: "Sơ đồ mạng neural",
      sourceUrl: "https://example.com/neural-network.png",
    }]);
    expect(provider.mock.calls[0][0].messages[0].content).toContain("Không tạo ảnh và không bịa URL ảnh");
  });

  it("does not add an illustration when the search has no direct image source", async () => {
    provider.mockResolvedValueOnce({ text: "AI là lĩnh vực máy tính có thể thực hiện một số việc cần trí tuệ.", citations: [
      { title: "Giới thiệu AI", url: "https://example.com/ai" },
    ] });

    const result = await answerAssistantResearchQuestion({ question: "AI là gì?", messages: [] }, "information");

    expect(result.illustrations).toBeUndefined();
  });

  it("adds a downloaded Commons image with its source page to an explanatory answer", async () => {
    provider.mockResolvedValueOnce({ text: "AI cho phép hệ thống thực hiện các tác vụ thông minh.", citations: [
      { title: "Giới thiệu AI", url: "https://example.com/ai" },
    ] });
    commonsImageSearch.mockResolvedValueOnce({
      illustration: { alt: "Sơ đồ AI", url: "data:image/webp;base64,YQ==", sourceTitle: "Sơ đồ AI", sourceUrl: "https://example.org/diagram" },
      source: { title: "Sơ đồ AI", url: "https://example.org/diagram" },
    });

    const result = await answerAssistantResearchQuestion({ question: "AI là gì?", messages: [] }, "information");

    expect(commonsImageSearch).toHaveBeenCalledOnce();
    expect(result.illustrations?.[0].sourceUrl).toBe("https://example.org/diagram");
    expect(result.sources).toContainEqual({ title: "Sơ đồ AI", url: "https://example.org/diagram" });
    expect(commonsImageSearch).toHaveBeenCalledWith("artificial intelligence");
  });

  it("adds a relevant gold illustration to current gold-price research", async () => {
    provider.mockResolvedValueOnce({ text: "Giá vàng mới nhất được tổng hợp theo sản phẩm và nguồn công bố." });
    commonsImageSearch.mockResolvedValueOnce({
      illustration: { alt: "Gold ingots", url: "data:image/webp;base64,YQ==", sourceTitle: "Gold ingots", sourceUrl: "https://commons.wikimedia.org/wiki/File:Gold_bar.jpg", sourceCredit: "Public domain" },
      source: { title: "Gold ingots", url: "https://commons.wikimedia.org/wiki/File:Gold_bar.jpg" },
    });

    const result = await answerAssistantResearchQuestion({ question: "giá vàng hôm nay", messages: [] }, "gold-prices");

    expect(commonsImageSearch).toHaveBeenCalledWith("gold bar");
    expect(result.illustrations?.[0].sourceTitle).toBe("Gold ingots");
    expect(result.sources).toContainEqual({ title: "Gold ingots", url: "https://commons.wikimedia.org/wiki/File:Gold_bar.jpg" });
  });

  it("keeps conversational roles and the current question separate from supplemental context", async () => {
    provider.mockResolvedValueOnce({ text: "Here is the revised introduction." });
    const messages = [
      { role: "user" as const, content: "Viết lời giới thiệu cho một câu lạc bộ sách." },
      { role: "assistant" as const, content: "Chào mừng bạn đến với câu lạc bộ sách!" },
    ];
    await answerAssistantGeneralQuestion({ question: "Rewrite it in English.", messages, responseRules: "Ưu tiên câu trả lời ngắn." });
    const request = provider.mock.calls[0][0];
    expect(request.messages.slice(-3)).toEqual([...messages, { role: "user", content: "Rewrite it in English." }]);
    expect(JSON.parse(request.messages[1].content).responseRules).toBe("Ưu tiên câu trả lời ngắn.");
    expect(request.messages[0].content).not.toContain("Chỉ nói về yêu cầu, thông tin còn thiếu, xác nhận và kết quả nghiệp vụ");
  });

  it.each([
    'Ví dụ JavaScript:\n```javascript\nconst data = {"name":"An","items":[1,2,3]};\n```',
    'Ví dụ JSON:\n```json\n{"message":"Xin chào","items":[1,2,3]}\n```',
    'Công thức: \\(f(x) = x^2\\). Danh sách: [1, 2, 3].',
  ])("preserves code, JSON examples, arrays and formulas: %s", async text => {
    provider.mockResolvedValueOnce({ text });
    await expect(answerAssistantGeneralQuestion({ question: "Cho mình một ví dụ và giải thích.", messages: [] })).resolves.toBe(text);
  });

  it("unwraps an accidental response envelope without rewriting the answer", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ reply: "Mình có thể giúp bạn học tiếng Anh." }) });
    await expect(answerAssistantGeneralQuestion({ question: "Bạn giúp mình học tiếng Anh nhé", messages: [] })).resolves.toBe("Mình có thể giúp bạn học tiếng Anh.");
  });

  it("preserves an explicitly requested JSON response even when it has an answer field", async () => {
    const text = JSON.stringify({ answer: "Xin chào" });
    provider.mockResolvedValueOnce({ text });
    await expect(answerAssistantGeneralQuestion({ question: "Trả lời dưới dạng JSON", messages: [] })).resolves.toBe(text);
  });

  it("returns a complete long answer instead of silently cutting it at 6000 characters", async () => {
    const text = "Nội dung chi tiết. ".repeat(400) + "Kết thúc phần giải thích.";
    provider.mockResolvedValueOnce({ text });
    await expect(answerAssistantGeneralQuestion({ question: "Giải thích thật chi tiết.", messages: [] })).resolves.toBe(text);
  });
});
