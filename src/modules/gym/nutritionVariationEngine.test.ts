import { describe, expect, it } from "vitest";
import { buildMealsFromTemplate, VIETNAMESE_7DAYS_TEMPLATES } from "./nutritionVariationEngine";

describe("thư viện đổi món của 3S", () => {
  it("có bảy mẫu ngày và phân bổ từ hai đến năm bữa với thông tin từng món", () => {
    expect(VIETNAMESE_7DAYS_TEMPLATES).toHaveLength(7);
    for (const mealCount of [2, 3, 4, 5]) {
      const meals = buildMealsFromTemplate(VIETNAMESE_7DAYS_TEMPLATES[0], 1800, mealCount);
      expect(meals).toHaveLength(mealCount);
      expect(meals.every(meal => meal.items.length > 0 && meal.items.every(item => item.name && item.amount && item.calories > 0))).toBe(true);
    }
  });
});
