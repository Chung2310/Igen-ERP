import { expect, it, vi } from "vitest";
const { generate, insert } = vi.hoisted(() => ({
  generate: vi.fn(),
  insert: vi.fn().mockResolvedValue({}),
}));
vi.mock("../marketing-suite/shared/service/gemini/image.service", () => ({
  geminiImageService: { generateImage: generate },
}));
vi.mock("./store", () => ({
  records: () => ({ insertOne: insert }),
  publicRecord: (value: unknown) => value,
  saveRecord: vi.fn(),
}));
import { getAiUsageContext } from "../../service/ai-usage.service";
import { saveImage } from "./media";
const actor = {
  role: "pt",
  userId: "pt-1",
  companyCode: "GYM_A",
  branchId: "branch-1",
};
it("uses the ERP AI usage context and calls the existing image provider exactly once", async () => {
  generate.mockImplementationOnce(async () => {
    expect(getAiUsageContext()).toMatchObject({
      companyCode: "GYM_A",
      userId: "pt-1",
    });
    return { url: "https://example.invalid/meal.webp", isMock: false };
  });
  const result = await saveImage(
    actor,
    { name: "Cá hồi áp chảo", category: "PROTEIN" },
    undefined,
    true,
  );
  expect(result.source).toBe("AI");
  expect(generate).toHaveBeenCalledTimes(1);
  expect(insert).toHaveBeenCalledTimes(1);
  expect(getAiUsageContext()).toBeUndefined();
});
it("does not bypass the ERP quota or store fake images when generation fails", async () => {
  generate.mockReset();
  insert.mockClear();
  generate.mockRejectedValueOnce(new Error("Đã hết lượt sử dụng AI."));
  await expect(
    saveImage(actor, { name: "Cơm gà" }, undefined, true),
  ).rejects.toThrow("Đã hết lượt");
  expect(generate).toHaveBeenCalledTimes(1);
  expect(insert).not.toHaveBeenCalled();
});
