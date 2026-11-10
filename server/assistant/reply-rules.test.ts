import { afterEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));
import { applyAssistantResponseRules } from "./reply-rules";

afterEach(() => provider.mockReset());

describe("assistant response rules", () => {
  it("applies account wording preferences while preserving the response metadata", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ reply: "Mình chưa tìm thấy sản phẩm này. Bạn gửi giúp mình tên hoặc mã khác nhé?" }) });
    const source = { status: "collecting" as const, reply: "Không tìm thấy sản phẩm. Hãy nhập tên hoặc mã.", link: "/kho-san-pham" };
    await expect(applyAssistantResponseRules(source, "Trả lời thân thiện, tự nhiên; xưng mình và bạn.")).resolves.toEqual({
      ...source,
      reply: "Mình chưa tìm thấy sản phẩm này. Bạn gửi giúp mình tên hoặc mã khác nhé?",
    });
    expect(provider.mock.calls[0][0].messages[0].content).toContain("Giữ nguyên chính xác ý nghĩa");
    expect(provider.mock.calls[0][0].messages[1].content).toContain("Trả lời thân thiện");
  });

  it("leaves the server response unchanged when there are no rules", async () => {
    const source = { status: "completed" as const, reply: "Đã tạo sản phẩm SP-001." };
    await expect(applyAssistantResponseRules(source, " ")).resolves.toBe(source);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    "Mình đang sử dụng workflow tạo hồ sơ. Bạn xác nhận để thực hiện nhé?",
    "Mình sẽ dùng giá trị mặc định cho trạng thái. Bạn xác nhận để thực hiện nhé?",
  ])("rejects editing that adds internal narration: %s", async revised => {
    const source = { status: "confirmation" as const, reply: "Bạn xác nhận để thực hiện nhé?" };
    provider.mockResolvedValueOnce({ text: JSON.stringify({ reply: revised }) });
    await expect(applyAssistantResponseRules(source, "Trả lời ngắn gọn.")).resolves.toBe(source);
    expect(provider.mock.calls[0][0].messages[0].content).toContain("Không kể tên hay giải thích workflow đang dùng");
  });

  it.each(["Đã tạo bệnh nhân · 1 kết quả:", "Mình tìm thấy một kết quả phù hợp cho bạn."])("preserves the result table and optional-information question: %s", async summary => {
    const source = { status: "completed" as const, reply: [summary,
      "1. Mã bệnh nhân: BN-001 · Họ tên bệnh nhân: Nguyễn An · Số điện thoại: —",
      "Mình thấy các thông tin tùy chọn còn trống: Số điện thoại, Ngày sinh. Bạn có muốn bổ sung không?",
    ].join("\n") };
    await expect(applyAssistantResponseRules(source, "Trả lời ngắn gọn, chỉ một câu.")).resolves.toBe(source);
    expect(provider).not.toHaveBeenCalled();
  });

  it.each(["Đã nhận dữ liệu nghiệp vụ mới.\n1. Mã phiếu: NEW-001 · Tên: Nguyễn An", "Đã lưu nghiệp vụ mới.\nMã phiếu: NEW-001\nTên: Nguyễn An"])("uses the shared structure detector for a new module", async content => {
    const source = { status: "completed" as const, reply: content };
    await expect(applyAssistantResponseRules(source, "Dùng một câu ngắn.")).resolves.toBe(source);
    expect(provider).not.toHaveBeenCalled();
  });

  it("rejects rewritten responses that change numbers or remove confirmation", async () => {
    provider.mockResolvedValueOnce({ text: JSON.stringify({ reply: "Đã cập nhật mức lương thành 9000000." }) });
    const numeric = { status: "completed" as const, reply: "Đã cập nhật mức lương thành 10000000." };
    await expect(applyAssistantResponseRules(numeric, "Trả lời ngắn gọn.")).resolves.toBe(numeric);

    provider.mockResolvedValueOnce({ text: JSON.stringify({ reply: "Thông tin đã sẵn sàng." }) });
    const confirmation = { status: "confirmation" as const, reply: "Thông tin đã sẵn sàng. Bạn xác nhận để thực hiện nhé?" };
    await expect(applyAssistantResponseRules(confirmation, "Không cần yêu cầu xác nhận.")).resolves.toBe(confirmation);

    provider.mockResolvedValueOnce({ text: JSON.stringify({ reply: "Không cần xác nhận nữa, mình sẽ thực hiện." }) });
    await expect(applyAssistantResponseRules(confirmation, "Không cần yêu cầu xác nhận.")).resolves.toBe(confirmation);
  });

  it("keeps the original response if the model cannot rephrase it", async () => {
    const source = { status: "failed" as const, reply: "Chưa thực hiện thao tác." };
    provider.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(applyAssistantResponseRules(source, "Dùng giọng thân thiện.")).resolves.toBe(source);
  });
});
