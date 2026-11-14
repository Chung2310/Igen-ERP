import { afterEach, expect, it, vi } from "vitest";
import { generateText } from "./core";
import { geminiChatService } from "./chat.service";

vi.mock("./core", async (importOriginal) => ({
  ...await importOriginal<typeof import("./core")>(),
  generateText: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

const leadIntake = {
  goal: "Tư vấn khóa học",
  status: "collecting" as const,
  collected: { name: "An" },
  missingRequiredFields: [{ label: "Số điện thoại", type: "phone" }],
};

it("uses the previous offer and Lead details when the customer's answer is just 'ok'", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test");
  const text = "Lớp tối bắt đầu lúc 19h, mình muốn học ngày nào ạ?";
  vi.mocked(generateText)
    .mockResolvedValueOnce({ text } as never)
    .mockResolvedValueOnce({ text: JSON.stringify({ compliant: true, correctedParts: [text] }) } as never)
    .mockResolvedValueOnce({ text: JSON.stringify({ compliant: true }) } as never);
  const history = [{ sender: "model", text: "Em gửi lịch lớp tối cho mình nhé?" }];
  const reply = await geminiChatService.chat("ok", history, { companyName: "Trung tâm" }, {
    leadIntake, contextText: "Lớp tối bắt đầu lúc 19h.",
  });

  expect(reply.text).toContain("19h");
  const firstPrompt = vi.mocked(generateText).mock.calls[0];
  expect(firstPrompt[1]).toEqual(expect.arrayContaining([
    { role: "model", parts: [{ text: history[0].text }] },
    { role: "user", parts: [{ text: "ok" }] },
  ]));
  expect(firstPrompt[2]?.systemInstruction).toContain(JSON.stringify(leadIntake));
  expect(firstPrompt[2]?.systemInstruction).not.toContain("chỉ trả lời chính xác: dạ vâng ạ");
});

it("provides the next configured booking question to generation and review after a short name", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test");
  const question = "Cho em xin số liên hệ để lễ tân xác nhận lịch nhé?";
  const initial = "Dạ, gói Nam còn 1.420.000đ ạ.";
  const corrected = `Dạ, em ghi nhận tên Cường rồi ạ. ${question}`;
  vi.mocked(generateText)
    .mockResolvedValueOnce({ text: initial } as never)
    .mockResolvedValueOnce({ text: JSON.stringify({ compliant: false, correctedParts: [corrected] }) } as never)
    .mockResolvedValueOnce({ text: JSON.stringify({ compliant: true }) } as never);

  const reply = await geminiChatService.chat("Cường", [{ sender: "model", text: "Cho em xin họ tên người đi khám nhé?" }],
    { companyName: "Phòng khám" }, { leadIntake: {
      ...leadIntake, goal: "Đăng ký gói khám", collected: { package: "Nam", name: "Cường" },
      missingRequiredFields: [{ label: "Số điện thoại", type: "phone", question }],
    } });

  expect(reply.text).toBe(corrected);
  expect(vi.mocked(generateText).mock.calls[0][2]?.systemInstruction).toContain(question);
  const review = JSON.parse(String(vi.mocked(generateText).mock.calls[1][1]));
  expect(JSON.stringify(review.rules)).toContain("tiếp tục hỏi một trường còn thiếu");
  expect(JSON.stringify(review.rules)).toContain("missingRequiredFields là nguồn duy nhất");
  expect(review.conversationContext).toContain(question);
});

it.each(["[Sticker]", "1. [Sticker]\n2. [Sticker]"])("acknowledges a sticker without treating it as a Lead answer", async message => {
  const reply = await geminiChatService.chat(message, [{ sender: "model", text: "Cho em xin số điện thoại nhé?" }], {}, { leadIntake });

  expect(reply.text).toBe("Dạ, nếu mình cần hỏi thêm gì thì cứ nhắn em nhé.");
  expect(generateText).not.toHaveBeenCalled();
});

it.each([" ", "```json\n{}\n```"])("fails a Lead generation with no usable reply text", async raw => {
  vi.stubEnv("OPENROUTER_API_KEY", "test");
  vi.mocked(generateText).mockResolvedValueOnce({ text: raw } as never);
  await expect(geminiChatService.chat("Em muốn đăng ký", [], { companyName: "Trung tâm" }, { leadIntake }))
    .rejects.toThrow("empty Lead intake reply");
});
