export type AttendanceRecordStatus = "present" | "absent" | "excused" | "late";

export interface AttendanceRecordSnapshot {
  studentId: string;
  status: AttendanceRecordStatus;
}

export interface AttendanceSessionSnapshot {
  date: string;
  note?: string;
  records: AttendanceRecordSnapshot[];
  [key: string]: unknown;
}

/** Update one learner's attendance while preserving the rest of the session. */
export function upsertAttendanceRecord(
  sessions: readonly AttendanceSessionSnapshot[],
  date: string,
  studentId: string,
  status: AttendanceRecordStatus,
): AttendanceSessionSnapshot[] {
  let sessionFound = false;
  const next = sessions.map((session) => {
    if (session.date !== date) return session;
    sessionFound = true;

    let recordFound = false;
    const records = (session.records || []).map((record) => {
      if (String(record.studentId) !== studentId) return record;
      recordFound = true;
      return { ...record, status };
    });

    if (!recordFound) records.push({ studentId, status });
    return { ...session, records };
  });

  if (!sessionFound) next.push({ date, note: "", records: [{ studentId, status }] });
  return next;
}
