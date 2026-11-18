import { CHAT_TEST_MAX_IMAGES, CHAT_TEST_MAX_IMAGE_BYTES } from "../../../../../shared/marketing-suite/chat-test";
import { prepareChatImages } from "./chat-visual-context";
import { normalizeInvoiceValue } from "./telecom-invoice-values";

export interface ChatTestImage { data: string; hash?: string; fileName?: string }
export interface ChatTestReading { values: Record<string, string> }
export interface ChatTestDocument { values: Record<string, string>; imageNumbers: number[]; subscriberCode?: string; conflicts: string[] }

export async function prepareChatTestUploads(files: Array<{ buffer: Buffer; mimetype: string; originalname: string }>) {
  if (files.length > CHAT_TEST_MAX_IMAGES) throw Object.assign(new Error("Mỗi lượt gửi tối đa 3 ảnh."), { status: 400 });
  if (!files.length) return [];
  if (files.reduce((sum, file) => sum + file.buffer.length, 0) > CHAT_TEST_MAX_IMAGE_BYTES) {
    throw Object.assign(new Error("Tổng dung lượng ảnh mỗi lượt tối đa 8 MB."), { status: 400 });
  }
  const prepared = await prepareChatImages(files.map((file, index) => ({
    dataUrl: `data:${file.mimetype};base64,${file.buffer.toString("base64")}`, messageId: String(index),
  })));
  if (prepared.failure || !prepared.images.length) throw Object.assign(new Error("Ảnh không hợp lệ. Chọn ảnh JPEG, PNG, WebP hoặc GIF."), { status: 400 });
  const images = prepared.images.map(image => ({ data: image.dataUrl, hash: image.hash,
    fileName: files[Number(image.messageId)].originalname.slice(0, 200) }));
  assertChatTestImages(images);
  return images;
}

export function assertChatTestImages(images: ChatTestImage[]) {
  if (images.length > CHAT_TEST_MAX_IMAGES || images.some(image => typeof image.data !== "string")
    || images.reduce((sum, image) => sum + Buffer.byteLength(image.data), 0) > Math.ceil(CHAT_TEST_MAX_IMAGE_BYTES / 3) * 4 + 512) {
    throw Object.assign(new Error("Mỗi lượt tối đa 3 ảnh, tổng dung lượng tối đa 8 MB."), { status: 400 });
  }
}

/** Merge only the same explicit subscriber. Missing identifiers remain separate. */
export function groupChatTestReadings(readings: ChatTestReading[], subscriberFieldKey?: string): ChatTestDocument[] {
  const documents: ChatTestDocument[] = [];
  for (const [index, reading] of readings.entries()) {
    const subscriberCode = subscriberFieldKey ? normalizeInvoiceValue("subscriberCode", reading.values[subscriberFieldKey]) : undefined;
    let document = documents.find(item => subscriberFieldKey ? subscriberCode && item.subscriberCode === subscriberCode : true);
    if (!document) {
      document = { values: {}, subscriberCode, imageNumbers: [], conflicts: [] };
      documents.push(document);
    }
    document.imageNumbers.push(index + 1);
    for (const [key, raw] of Object.entries(reading.values)) {
      const value = key === subscriberFieldKey && subscriberCode ? subscriberCode : raw;
      if (document.conflicts.includes(key)) continue;
      if (document.values[key] && document.values[key] !== value) {
        document.conflicts.push(key); delete document.values[key];
      } else document.values[key] = value;
    }
  }
  return documents;
}
