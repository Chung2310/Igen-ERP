// Match the whole message: a greeting followed by a business question must
// still go through retrieval and the normal access/grounding checks.
export function resolveConversationReply(question: string): string | undefined {
  const normalized = question
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    /^(hello|hi|hey|alo|chao|xin chao)( (ban|ad|admin|ai|tro ly|luxcare|ca nha))?( (a|nhe|nha|oi))?$/.test(normalized)
  ) {
    return "Xin chào! Tôi là Trợ lý AI LuxCare. Bạn cần tôi hỗ trợ tra cứu thông tin gì?";
  }
  if (/^(cam on( ban|tro ly|ai|luxcare)?( nhieu| rat nhieu)?|thank you|thanks)( nhe| nha| a)?$/.test(normalized)) {
    return "Rất vui được hỗ trợ bạn! Bạn cần tra cứu thêm thông tin gì không?";
  }
  if (/^(tam biet( ban)?|bye|goodbye|hen gap lai)$/.test(normalized)) {
    return "Tạm biệt bạn! Khi cần hỗ trợ, bạn có thể quay lại trò chuyện với tôi.";
  }
  if (
    /^(ban la ai|ban (co the )?(lam (duoc )?gi|giup (duoc )?gi|ho tro (duoc )?gi)|huong dan su dung( tro ly( ai)?)?|help)$/.test(
      normalized,
    )
  ) {
    return "Tôi là Trợ lý AI LuxCare, hỗ trợ tra cứu tài liệu và một số thống kê tổng số trong phạm vi bạn được phép truy cập. Bạn hãy nêu rõ nội dung cần tìm, ví dụ: “Chính sách nghỉ phép là gì?” hoặc “Có bao nhiêu dự án?”.";
  }
  return undefined;
}
