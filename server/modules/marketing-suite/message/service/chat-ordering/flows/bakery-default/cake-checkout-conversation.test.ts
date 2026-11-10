import { describe, expect, it } from "vitest";
import { cakeIntakeQuestion, cakeSizeClarification, isAffirmativeSizeReply, resolveCakeRecipientName } from "./cake-checkout-conversation";

describe("cake checkout conversation helpers", () => {
  it("uses the buyer name when the buyer says the recipient is themself", () => {
    expect(resolveCakeRecipientName({
      message: "Tôi tên là Khách thử Vibary; người nhận là tôi.",
      extractedName: "tôi", buyerName: "Khách thử Vibary",
    })).toBe("Khách thử Vibary");
  });

  it("does not persist a pronoun as the recipient name", () => {
    expect(resolveCakeRecipientName({ message: "Người nhận là tôi", extractedName: "tôi" })).toBe("");
    expect(resolveCakeRecipientName({ message: "Người nhận là tôi", extractedName: "tôi", previousName: "Mai Anh" })).toBe("Mai Anh");
  });

  it("recognizes a short yes only after a size choice prompt", () => {
    expect(isAffirmativeSizeReply("có", "Anh chị chọn size nào nhé?" )).toBe(true);
    expect(isAffirmativeSizeReply("có", "Anh chị muốn đặt bánh dịp gì?" )).toBe(false);
    expect(cakeSizeClarification("anh chị")).toContain("một size cụ thể");
  });

  it("asks for the date and type once when the customer requests a birthday cake", () => {
    expect(cakeIntakeQuestion({ customerMessages: ["tôi muốn đặt bánh sinh nhật"] }))
      .toContain("ngày nào");
    expect(cakeIntakeQuestion({ customerMessages: ["tôi muốn đặt bánh sinh nhật", "sinh nhật"] }))
      .toContain("ngày cần nhận");
    expect(cakeIntakeQuestion({ customerMessages: ["tôi muốn đặt bánh sinh nhật", "sinh nhật", "ngày mai"] }))
      .toBe("Dạ, em ghi nhận bánh sinh nhật ạ. Anh/chị muốn chọn loại bánh hoặc mẫu nào?");
  });
});
