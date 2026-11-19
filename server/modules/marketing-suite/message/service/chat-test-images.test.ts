import { expect, it } from "vitest";
import sharp from "sharp";
import { assertChatTestImages, groupChatTestReadings, prepareChatTestUploads } from "./chat-test-images";

it("merges only the same subscriber and never attaches an unidentified infrastructure image to another account", () => {
  expect(groupChatTestReadings([
    { values: { account: "abc_1", name: "An" } }, { values: { account: "ABC_1", phone: "0901234567" } },
    { values: { account: "abc_2", name: "Bình" } }, { values: { terminal: "TRAM-01" } },
  ], "account")).toEqual([
    { subscriberCode: "ABC_1", values: { account: "ABC_1", name: "An", phone: "0901234567" }, imageNumbers: [1, 2], conflicts: [] },
    { subscriberCode: "ABC_2", values: { account: "ABC_2", name: "Bình" }, imageNumbers: [3], conflicts: [] },
    { subscriberCode: undefined, values: { terminal: "TRAM-01" }, imageNumbers: [4], conflicts: [] },
  ]);
});

it("removes conflicting values instead of silently picking an image", () => {
  const result = groupChatTestReadings([
    { values: { name: "An", phone: "0901234567" } }, { values: { name: "Bình", address: "Hà Nội" } },
    { values: { name: "An" } },
  ]);
  expect(result[0]).toMatchObject({ values: { phone: "0901234567", address: "Hà Nội" }, conflicts: ["name"] });
  expect(result[0].values).not.toHaveProperty("name");
});

it("validates every image, keeps order and names, and deduplicates identical pixels", async () => {
  const make = async (color: string, name: string) => ({
    buffer: await sharp({ create: { width: 3, height: 3, channels: 3, background: color } }).png().toBuffer(),
    mimetype: "image/png", originalname: name,
  });
  const first = await make("red", "first.png");
  const second = await make("green", "second.png");
  const result = await prepareChatTestUploads([first, second, first]);
  expect(result).toHaveLength(2);
  expect(result.map(image => image.fileName)).toEqual(["first.png", "second.png"]);
  await expect(prepareChatTestUploads([first, { buffer: Buffer.from("invalid"), mimetype: "image/png", originalname: "bad.png" }])).rejects.toThrow("Ảnh không hợp lệ");
});

it("caps image count and total bytes before storing a MongoDB message", async () => {
  const file = { buffer: Buffer.alloc(1), mimetype: "image/png", originalname: "image.png" };
  await expect(prepareChatTestUploads([file, file, file, file])).rejects.toThrow("tối đa 3 ảnh");
  await expect(prepareChatTestUploads([{ ...file, buffer: Buffer.alloc(5 * 1024 * 1024) }, { ...file, buffer: Buffer.alloc(4 * 1024 * 1024) }])).rejects.toThrow("Tổng dung lượng");
  expect(() => assertChatTestImages(Array.from({ length: 4 }, () => ({ data: "data:image/png;base64,AA==" })))).toThrow("tối đa 3 ảnh");
});
