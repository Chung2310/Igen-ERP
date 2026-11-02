import { describe, expect, it } from "vitest";
import { couponDiscount, normalizeCouponCode, validateCouponInput } from "./retail-coupon.service";
import { birthdayWindow } from "./retail-birthday-coupon.service";

describe("mã ưu đãi bán lẻ", () => {
  it("giới hạn số tiền giảm theo đơn, trần mã và thời hạn", () => {
    const coupon = { active: true, startsAt: new Date("2026-01-01"), endsAt: new Date("2027-01-01"), usedCount: 0,
      minSubtotal: 100_000, discountType: "percent", value: 20, maxDiscount: 30_000 };
    expect(couponDiscount(coupon, 200_000, new Date("2026-06-01"))).toBe(30_000);
    expect(() => couponDiscount(coupon, 90_000, new Date("2026-06-01"))).toThrow();
    expect(() => couponDiscount(coupon, 200_000, new Date("2027-01-01"))).toThrow();
  });

  it("chuẩn hóa mã và khóa giới hạn mã dành riêng cho khách", () => {
    expect(normalizeCouponCode(" sale_20 ")).toBe("SALE_20");
    expect(() => validateCouponInput({ code: "SALE20", name: "Mã riêng", discountType: "amount", value: 10000,
      startsAt: "2026-01-01", endsAt: "2027-01-01", customerId: "507f1f77bcf86cd799439011", usageLimit: 2 })).toThrow();
  });

  it("phát mã sinh nhật 29/2 vào 28/2 của năm không nhuận", () => {
    const window = birthdayWindow(new Date("2000-02-29T05:00:00Z"), new Date("2027-02-28T05:00:00Z"), 30);
    expect(window.startsAt.toISOString()).toBe("2027-02-27T17:00:00.000Z");
    expect(+window.endsAt - +window.startsAt).toBe(30 * 86400000);
  });
});
