import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATES, emptyVariables, renderMarketingTemplate } from "./marketing-template";
import { resolveMarketingSettings } from "./marketing-settings.service";

describe("renderMarketingTemplate", () => {
  const variables = { ...emptyVariables(), customerName: "Chị Lan", companyName: "IGEN", orderCode: "DH-001" };

  it("thay biến bằng giá trị tương ứng", () => {
    expect(renderMarketingTemplate("Chào {{customerName}} từ {{companyName}}", variables)).toBe("Chào Chị Lan từ IGEN");
  });

  it("escape HTML trong dữ liệu khách hàng để tránh vỡ mẫu", () => {
    const rendered = renderMarketingTemplate("<p>{{customerName}}</p>", { ...variables, customerName: "<b>hack</b>" });
    expect(rendered).toBe("<p>&lt;b&gt;hack&lt;/b&gt;</p>");
  });

  it("từ chối biến không hỗ trợ", () => {
    expect(() => renderMarketingTemplate("Xin chào {{unknownVar}}", variables)).toThrow(/MARKETING_UNKNOWN_VARIABLE/);
  });

  it("mọi mẫu mặc định đều render được", () => {
    for (const template of Object.values(DEFAULT_TEMPLATES)) {
      expect(() => renderMarketingTemplate(template.subject, variables)).not.toThrow();
      expect(() => renderMarketingTemplate(template.html, variables)).not.toThrow();
    }
  });
});

describe("resolveMarketingSettings", () => {
  it("điền mẫu mặc định và kênh email khi công ty chưa cấu hình", () => {
    const settings = resolveMarketingSettings("igen", undefined);
    expect(settings.companyCode).toBe("IGEN");
    expect(settings.sendTime).toBe("08:00");
    expect(settings.thank_you.enabled).toBe(false);
    expect(settings.thank_you.channels).toEqual(["email"]);
    expect(settings.birthday.subject).toBe(DEFAULT_TEMPLATES.birthday.subject);
    expect(settings.remarketingInactiveDays).toBe(90);
  });

  it("giữ nguyên cấu hình đã lưu và loại kênh lạ", () => {
    const settings = resolveMarketingSettings("IGEN", {
      sendTime: "09:30",
      birthday: { enabled: true, channels: ["zalo", "khong-ton-tai"], subject: "Mừng sinh nhật", html: "<p>hi</p>" },
    });
    expect(settings.sendTime).toBe("09:30");
    expect(settings.birthday.enabled).toBe(true);
    expect(settings.birthday.channels).toEqual(["zalo"]);
    expect(settings.birthday.subject).toBe("Mừng sinh nhật");
  });
});
