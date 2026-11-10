import { afterEach, describe, expect, it, vi } from "vitest";
import { findGuestPriceGuidance, findVerifiedPageContact, resolveAcceptedStaffOffer, simulatePageChat } from "./page-chat-simulator";
import { aiKnowledgeService } from "./ai-knowledge.service";
import { generateReplyCompletion } from "../../message/service/ai-reply-provider";
vi.mock("./ai-knowledge.service", () => ({ aiKnowledgeService: {
  prepareChatContext: vi.fn(), getFullPricingContext: vi.fn().mockResolvedValue(""),
} }));
vi.mock("../../message/service/ai-reply-provider", () => ({ generateReplyCompletion: vi.fn() }));

afterEach(() => vi.unstubAllEnvs());
describe("Page chat simulation", () => {
  it("uses the meeting document and conversation history without sending or saving", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.mocked(aiKnowledgeService.prepareChatContext).mockResolvedValue({ contextText: "Sơn ngoại thất", scenarioContextText: "", matches: 1 } as any);
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({ text: "Diện tích mỗi tầng khoảng bao nhiêu ạ?", stage: "Tìm hiểu công trình", known: { floors: "3" }, nextStep: "Hỏi diện tích" }) } as any);
    const result = await simulatePageChat({ companyCode: "ACME", message: "Nhà anh 3 tầng", history: [
      { role: "customer", text: "Anh đang xây nhà" }, { role: "bot", text: "Nhà mình có mấy tầng ạ?" },
    ], documentText: "NỘI DUNG HỌP - ANH GIÁP: không hỏi lại thông tin đã biết." });
    expect(result).toMatchObject({ text: "Diện tích mỗi tầng khoảng bao nhiêu ạ?", known: { floors: "3" }, sources: ["Tệp mô phỏng", "Kho tri thức"] });
    const request = vi.mocked(generateReplyCompletion).mock.calls[0][0];
    expect(JSON.stringify(request)).toContain("NỘI DUNG HỌP - ANH GIÁP");
    expect(JSON.stringify(request)).toContain("Anh đang xây nhà");
    expect(JSON.stringify(request)).toContain("Màn hình mô phỏng không có thao tác chuyển nhân viên");
  });

  it("adds a documented price matched to the customer's guest count to the answer context", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.mocked(aiKnowledgeService.prepareChatContext).mockResolvedValue({
      contextText: "", scenarioContextText: "Có 9 đến 11 người thì bánh 380k hoặc bánh 400k.", matches: 1,
    } as any);
    vi.mocked(aiKnowledgeService.getFullPricingContext).mockResolvedValue("Hotline liên hệ 0912550335");
    vi.mocked(generateReplyCompletion).mockResolvedValue({ text: JSON.stringify({
      text: "Mẫu Doraemon cần xác nhận phụ phí.", stage: "Tư vấn", known: {}, nextStep: "Gọi tiệm",
    }) } as any);
    await simulatePageChat({ companyCode: "ACME", message: "Bông lan trứng muối trang trí Doraemon, nhận ngày mai", history: [
      { role: "customer", text: "Nhà mình có 10 người ăn" },
      { role: "bot", text: "Bạn muốn vị bánh nào?" },
    ] });
    const request = JSON.stringify(vi.mocked(generateReplyCompletion).mock.calls.at(-1)?.[0]);
    expect(request).toContain("nhóm 9–11 người có mức 380.000đ hoặc 400.000đ");
    expect(request).toContain("Hotline 0912550335");
  });
});

it("resolves consent to a staff offer with a verified contact and known price, without pretending it was transferred", () => {
  const reference = "Quy trình: Có 9 đến 11 người thì bánh 380k hoặc bánh 400k. Hotline liên hệ 0912550335.";
  expect(findGuestPriceGuidance(reference, ["Mình đặt cho 10 người ăn"])).toBe("nhóm 9–11 người có mức 380.000đ hoặc 400.000đ");
  expect(findVerifiedPageContact(reference)).toBe("0912550335");
  const result = resolveAcceptedStaffOffer({ message: "có", reference, history: [
    { role: "customer", text: "Mình đặt bánh cho 10 người ăn, mẫu Doraemon nhận ngày mai" },
    { role: "bot", text: "Bạn muốn mình chuyển nhân viên kiểm tra giúp không ạ?" },
  ] });
  expect(result?.text).toContain("380.000đ hoặc 400.000đ");
  expect(result?.text).toContain("0912550335");
  expect(result?.text).toContain("Em chưa chuyển yêu cầu tự động");
  expect(result?.text).not.toMatch(/đã chuyển|đã ghi nhận/i);
});
it("uses the clearly labeled paint rules when no AI key is configured", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.mocked(generateReplyCompletion).mockClear();
  const result = await simulatePageChat({
    companyCode: "ACME",
    message: "Anh đang xây nhà 3 tầng",
    history: [],
    documentText: "NỘI DUNG HỌP - ANH GIÁP: tư vấn mua sơn nhà theo từng giai đoạn.",
  });
  expect(result).toMatchObject({ mode: "rule_demo", stage: "Tư vấn công trình", known: { floors: "3" } });
  expect(result.text).toContain("Diện tích mỗi tầng");
  expect(generateReplyCompletion).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
});

it("remembers area, respects phone refusal and applies corrected floors", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "");
  const documentText = "Tài liệu tư vấn bán sơn nhà.";
  const history = [
    { role: "customer" as const, text: "Anh đang xây nhà 2 tầng." },
    { role: "bot" as const, text: "Diện tích mỗi tầng khoảng bao nhiêu?" },
    { role: "customer" as const, text: "Mỗi tầng 80 m², sơn trong nhà." },
    { role: "bot" as const, text: "Mình có thể cho số điện thoại?" },
  ];
  const refused = await simulatePageChat({ companyCode: "ACME", message: "Anh chưa muốn cho số điện thoại, cho anh xem mẫu sơn trước.", history, documentText });
  expect(refused.known).toMatchObject({ area: "80 m²", floors: "2" });
  expect(refused.text).not.toMatch(/cho em xin số điện thoại/i);
  const corrected = await simulatePageChat({ companyCode: "ACME", message: "Thực ra là nhà 3 tầng.", history, documentText });
  expect(corrected.known).toMatchObject({ area: "80 m²", floors: "3" });
  expect(corrected.text).toContain("đã cập nhật");
});
it("uses an uploaded paint scenario from the knowledge base when AI is unavailable", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "");
  vi.mocked(aiKnowledgeService.prepareChatContext).mockResolvedValue({
    contextText: "", scenarioContextText: "Hành trình khách mua sơn nhà", matches: 0,
  } as any);
  const result = await simulatePageChat({ companyCode: "ACME", message: "Anh đang xây nhà 3 tầng", history: [] });
  expect(result).toMatchObject({ mode: "rule_demo", sources: ["Kho tri thức", "Chế độ quy tắc"] });
});
