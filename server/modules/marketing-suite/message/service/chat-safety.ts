/** Keep Vietnamese accents: "tự vẫn" and "tư vấn" have different meanings. */
export function getCustomerSafetyReply(message: string): string | undefined {
  const text = message.normalize("NFC").toLowerCase();
  if (!/(?:^|[^\p{L}])(?:tự\s+(?:vẫn|tử|sát)|tự\s+làm\s+hại\s+(?:bản\s+thân|mình)|muốn\s+chết|không\s+muốn\s+sống\s+nữa)(?=$|[^\p{L}])/u.test(text)
    && !/\b(?:kill myself|end my life|suicide)\b/i.test(text)) return undefined;
  return "Mình rất lo khi nghe bạn nói vậy. Bạn có đang an toàn ngay lúc này không? Nếu bạn có thể làm hại bản thân ngay bây giờ, hãy rời xa vật có thể gây hại, nhờ một người bạn tin cậy ở cạnh và liên hệ cấp cứu địa phương hoặc đến cơ sở cấp cứu gần nhất. Mình có thể tiếp tục lắng nghe bạn ở đây.";
}
