export const STUDENT_STATUSES = [
  "Chờ nhập học",
  "Chờ KSK",
  "Đã KSK",
  "Đã nộp HS",
  "Đang học",
  "Đang thi",
  "Đã đậu",
  "Thi lại",
  "Nghỉ học",
  "Nợ học phí",
] as const;

export type StudentStatus = typeof STUDENT_STATUSES[number];
