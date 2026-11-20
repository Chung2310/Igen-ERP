const TOOL_KEYWORDS: Array<[string, RegExp]> = [
  ["payroll_summary", /lương|phiếu lương|kỳ lương/i],
  ["attendance_leave_summary", /chấm công|đi muộn|nghỉ phép|phép năm|ca làm/i],
  ["recruitment_summary", /tuyển dụng|ứng viên|phỏng vấn/i],
  ["project_summary", /dự án|công việc|kanban|kpi/i],
  ["equipment_summary", /thiết bị|máy móc|laptop/i],
  ["resource_summary", /tài nguyên|tài liệu|file/i],
  ["notification_summary", /thông báo|tin nhắn/i],
  ["hr_summary", /nhân sự|nhân viên|hợp đồng|đào tạo|quy trình/i],
];
export function resolveRetrievalQuestion(question: string, priorQuestions: string[] = [], clarificationPrompt = "") {
  const normalized = question
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .trim();
  const followup = /^(con|vay|the|neu vay)\b|thi sao|truong hop (do|nay)|dieu (do|nay)/i.test(normalized);
  const clarificationReply =
    clarificationPrompt.trim().endsWith("?") &&
    clarificationPrompt.length <= 350 &&
    normalized.split(/\s+/).length <= 12 &&
    !question.includes("?");
  // An explicit selection may be a full follow-up question, not just a short reply.
  const normalizeWords = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase()
      .match(/[a-z0-9]{2,}/g) || [];
  const offeredWords = new Set(
    normalizeWords(clarificationPrompt).filter(
      (word) =>
        ![
          "ban",
          "muon",
          "biet",
          "hoi",
          "ve",
          "hay",
          "hoac",
          "cho",
          "cua",
          "toi",
          "la",
          "nhung",
          "nao",
          "duoc",
        ].includes(word),
    ),
  );
  const explicitSelection =
    clarificationPrompt.trim().endsWith("?") &&
    clarificationPrompt.length <= 350 &&
    /^(ve\b|toi (?:hoi|muon hoi|muon biet) ve\b|y toi la\b)/i.test(normalized) &&
    new Set(normalizeWords(question).filter((word) => offeredWords.has(word))).size >= 2;
  const prior = priorQuestions.filter(Boolean).slice(-2).join("\n");
  return (followup || clarificationReply || explicitSelection) && prior
    ? `${prior}\n${question}`.slice(-3000)
    : question;
}
export function planAssistantSources(question: string) {
  const summary =
    /tổng (số|quan)|thống kê|bao nhiêu (dự án|công việc|thiết bị|nhân viên|nhân sự|ứng viên|vị trí|tài nguyên|tài liệu|thông báo|đơn nghỉ phép|bản ghi|kỳ)/i.test(
      question,
    );
  const unsupportedScope =
    /của tôi|của (anh|chị|bạn)|hôm nay|hôm qua|tuần|tháng|năm \d|từ ngày|đến ngày|chi nhánh|phòng ban|đang |đã |chưa |được duyệt/i.test(
      question,
    );
  return {
    knowledge: true,
    tools:
      summary && !unsupportedScope
        ? TOOL_KEYWORDS.filter(([, pattern]) => pattern.test(question))
            .map(([name]) => name)
            .slice(0, 3)
        : [],
  };
}
