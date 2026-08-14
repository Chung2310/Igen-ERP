export type AttendanceInterval = { workerId: string; start: Date; end: Date; sourceLogId: string; projectId?: string };
export type MergedAttendance = { workerId: string; projectId?: string; minutes: number; sourceLogIds: string[] };

/** Merges overlapping attendance intervals so a worker is never paid twice for one minute. */
export function mergeAttendanceIntervals(intervals: AttendanceInterval[], groupByProject = false): MergedAttendance[] {
  const groups = new Map<string, AttendanceInterval[]>();
  for (const interval of intervals) {
    if (!(interval.start instanceof Date) || !(interval.end instanceof Date) || interval.end <= interval.start) continue;
    const key = groupByProject ? `${interval.workerId}:${interval.projectId || ""}` : interval.workerId;
    groups.set(key, [...(groups.get(key) || []), interval]);
  }
  const merged: MergedAttendance[] = [];
  for (const rows of groups.values()) {
    rows.sort((left, right) => left.start.getTime() - right.start.getTime());
    let start = rows[0].start;
    let end = rows[0].end;
    let ids = [rows[0].sourceLogId];
    const workerId = rows[0].workerId;
    const projectId = groupByProject ? rows[0].projectId : undefined;
    const flush = () => merged.push({ workerId, projectId, minutes: Math.round((end.getTime() - start.getTime()) / 60_000), sourceLogIds: ids });
    for (const row of rows.slice(1)) {
      if (row.start <= end) {
        if (row.end > end) end = row.end;
        ids.push(row.sourceLogId);
      } else {
        flush(); start = row.start; end = row.end; ids = [row.sourceLogId];
      }
    }
    flush();
  }
  return merged;
}
