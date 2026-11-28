export function studentAttendanceSummary(batch: any, date: string) {
  const learners = new Set<string>((batch.learnerIds || []).map(String));
  const records = new Map<string, string>();
  for (const session of batch.attendanceSessions || []) if (session.date === date) {
    for (const record of session.records || []) if (learners.has(String(record.studentId))) records.set(String(record.studentId), String(record.status));
  }
  const count = (status: string) => [...records.values()].filter(value => value === status).length;
  const scheduled = date >= batch.startDate && date <= batch.endDate && (batch.daysOfWeek || []).includes(new Date(`${date}T12:00:00+07:00`).getUTCDay()) && !(batch.cancelledSessionDates || []).includes(date);
  return { className: batch.name || batch.code, courseTitle: batch.courseTitle, date,
    startTime: batch.startTime, endTime: batch.endTime, location: batch.location,
    remainingSlots: typeof batch.remainingSlots === "number" && Number.isFinite(batch.remainingSlots) ? batch.remainingSlots : undefined,
    total: learners.size,
    present: count("present"), late: count("late"), absent: count("absent"), excused: count("excused"), unrecorded: learners.size - records.size,
    note: !learners.size ? "Lớp chưa có học viên." : !records.size ? scheduled ? "Chưa có dữ liệu điểm danh; chưa thể kết luận đi đủ hay vắng." : "Ngày này không có lịch học đã lưu và chưa có điểm danh." : records.size === learners.size && count("absent") === 0 && count("excused") === 0 ? "Tất cả học viên đã được ghi nhận có mặt hoặc đi muộn." : "Đối chiếu các trạng thái điểm danh; chưa ghi nhận không đồng nghĩa vắng." };
}
