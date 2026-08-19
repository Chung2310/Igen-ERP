import { describe, expect, it } from "vitest";
import { MarketingSettingsModel } from "./marketing-settings.model";
import { MARKETING_AUTOMATION_TYPES } from "../permissions";

describe("MarketingSettingsModel", () => {
  it("có đúng một nhánh cấu hình cho mỗi loại tin tự động", () => {
    // Lệch tên trường ở đây khiến mongoose âm thầm bỏ dữ liệu khi lưu,
    // người dùng bật công tắc xong tải lại trang thấy tự tắt.
    for (const type of MARKETING_AUTOMATION_TYPES) {
      expect(MarketingSettingsModel.schema.path(`${type}.enabled`)).toBeDefined();
      expect(MarketingSettingsModel.schema.path(`${type}.subject`)).toBeDefined();
    }
  });

  it("giữ lại giá trị đã bật khi tạo document", () => {
    const doc: any = new MarketingSettingsModel({ companyCode: "IGEN", thank_you: { enabled: true, subject: "Cảm ơn" } });
    expect(doc.thank_you.enabled).toBe(true);
    expect(doc.thank_you.subject).toBe("Cảm ơn");
  });
});
