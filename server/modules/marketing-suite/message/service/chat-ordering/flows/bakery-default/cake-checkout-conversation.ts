import { normalizeCakeText } from "./cake-price-catalog";

const selfRecipientNames = new Set([
  "toi", "minh", "em", "anh", "chi", "co", "chu", "bac", "chung toi", "chung minh", "chinh toi", "chinh minh",
]);

function cleanName(value: string | undefined) {
  const name = value?.trim().replace(/[.!?]+$/, "").trim() || "";
  return name && !selfRecipientNames.has(normalizeCakeText(name)) ? name.slice(0, 120) : "";
}

export function resolveCakeRecipientName(input: {
  message: string; extractedName?: string; buyerName?: string; previousName?: string;
}) {
  const explicit = input.message.match(/(?:tên người nhận(?: bánh)?(?: là)?|người nhận tên|người nhận là)\s*[:\-]?\s*([^,.;\n]+)/iu)?.[1];
  const candidate = (explicit || input.extractedName || "").replace(/\s+(?:số điện thoại|sđt|sdt|liên hệ)\b.*$/iu, "").trim();
  return cleanName(candidate) || cleanName(input.buyerName) || cleanName(input.previousName);
}

export function isAffirmativeSizeReply(message: string, lastBotMessage: string) {
  const normalized = normalizeCakeText(message).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!new Set(["co", "co a", "co nhe", "da", "da a", "vang", "vang a", "duoc", "ok", "oke", "dong y", "yes"]).has(normalized)) return false;
  const previous = normalizeCakeText(lastBotMessage);
  return /\bchon\b/.test(previous) && /\bsize\b|\bkich thuoc\b/.test(previous);
}

export function cakeIntakeQuestion(input: {
  customerMessages: string[]; pickupAt?: string; guestCount?: number;
}) {
  const customerText = normalizeCakeText(input.customerMessages.join(" "));
  const latestCustomerText = normalizeCakeText(input.customerMessages.at(-1) || "");
  const birthday = /\bsinh nhat\b/.test(customerText);
  const tomorrow = /\bngay mai\b/.test(customerText);
  if (birthday && (tomorrow || input.pickupAt)) {
    return "Dạ, em ghi nhận bánh sinh nhật ạ. Anh/chị muốn chọn loại bánh hoặc mẫu nào?";
  }
  if (birthday && /^sinh nhat[.!?]*$/.test(latestCustomerText)) {
    return "Dạ, em ghi nhận bánh sinh nhật ạ. Anh/chị cho em biết ngày cần nhận và loại bánh hoặc mẫu mong muốn nhé?";
  }
  if (birthday) return "Dạ, anh/chị cần bánh sinh nhật vào ngày nào và muốn loại bánh hoặc mẫu nào ạ?";
  if (tomorrow || input.pickupAt) return "Dạ, em ghi nhận ngày nhận bánh rồi ạ. Anh/chị muốn chọn loại bánh hoặc mẫu nào?";
  if (input.guestCount) return `Dạ, mình cần bánh cho khoảng ${input.guestCount} người ạ. Anh/chị muốn chọn loại bánh hoặc mẫu nào?`;
  return "Anh/chị đã có mẫu bánh ưng ý chưa ạ? Nếu chưa, cho em biết dịp đặt bánh hoặc loại bánh muốn chọn nhé.";
}

export function cakeSizeClarification(customer = "anh/chị") {
  return `Dạ, ${customer} chọn giúp em một size cụ thể trong các phương án vừa gửi nhé?`;
}
