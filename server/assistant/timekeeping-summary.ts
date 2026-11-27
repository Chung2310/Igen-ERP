export type AttendanceSummaryInput = {
  date?: unknown;
  checkIn?: unknown;
};

export function summarizeDailyAttendance(records: readonly AttendanceSummaryInput[]) {
  const totalEmployees = records.length;
  const checkedIn = records.filter(record => record.checkIn !== null && record.checkIn !== undefined && record.checkIn !== "").length;
  const notCheckedIn = totalEmployees - checkedIn;
  return {
    ...(typeof records[0]?.date === "string" ? { date: records[0].date } : {}),
    totalEmployees,
    checkedIn,
    notCheckedIn,
    checkInRatePercent: totalEmployees ? Math.round((checkedIn / totalEmployees) * 10_000) / 100 : null,
  };
}
