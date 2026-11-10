import { describe, expect, it } from "vitest";
import { cakeServingRecommendationReply, isCakeServingRecommendation } from "./cake-serving-guidance";

describe("isCakeServingRecommendation", () => {
  it("recognizes guest-count advice without mistaking recipient capture for advice", () => {
    expect(isCakeServingRecommendation("Tiệc có 8 người, nên chọn size nào?" )).toBe(true);
    expect(isCakeServingRecommendation("Người nhận là mình; đặt 1 chiếc." )).toBe(false);
  });

  it("asks the customer to choose after recommending several sizes", () => {
    const reply = cakeServingRecommendationReply(10, [
      { id: "a", groupId: "cake", name: "Bánh kem", shape: "Tròn", size: "22", height: 7, packQuantity: 1, unit: "bánh", price: 380000, needsApproval: false, source: "" },
      { id: "b", groupId: "cake", name: "Bánh kem", shape: "Vuông", size: "22x22", height: null, packQuantity: 1, unit: "bánh", price: 390000, needsApproval: false, source: "" },
    ], [{ minGuests: 10, maxGuests: 10, prices: [380000, 390000] }]);

    expect(reply).toContain("Size 22cm, cao 7cm");
    expect(reply).toContain("Anh/chị muốn chọn size nào ạ?");
  });

  it("asks whether the customer wants the single recommended size", () => {
    const reply = cakeServingRecommendationReply(10, [
      { id: "a", groupId: "cake", name: "Bánh kem", shape: "Tròn", size: "22", height: 7, packQuantity: 1, unit: "bánh", price: 380000, needsApproval: false, source: "" },
    ], [{ minGuests: 10, maxGuests: 10, prices: [380000] }]);

    expect(reply).toContain("Anh/chị muốn chọn size này ạ?");
  });
});
