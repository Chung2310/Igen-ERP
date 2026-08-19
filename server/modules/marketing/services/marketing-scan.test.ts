import { describe, expect, it } from "vitest";
import { isSendTime, vietnamParts } from "./marketing-scan.service";

describe("vietnamParts", () => {
  it("quy đổi thời điểm UTC sang ngày giờ Việt Nam", () => {
    const parts = vietnamParts(new Date("2026-08-19T01:00:00Z"), "Asia/Ho_Chi_Minh");
    expect(parts).toMatchObject({ date: "2026-08-19", month: "08", day: "19", time: "08:00" });
  });

  it("qua nửa đêm giờ VN thì sang ngày mới", () => {
    expect(vietnamParts(new Date("2026-08-19T17:30:00Z"), "Asia/Ho_Chi_Minh").date).toBe("2026-08-20");
  });
});

describe("isSendTime", () => {
  const settings = { timeZone: "Asia/Ho_Chi_Minh", sendTime: "08:00" };

  it("đúng phút cấu hình mới chạy quét", () => {
    expect(isSendTime(new Date("2026-08-19T01:00:00Z"), settings)).toBe(true);
    expect(isSendTime(new Date("2026-08-19T01:01:00Z"), settings)).toBe(false);
  });
});
