export interface AttendanceOverviewLog {
  uid: string;
  date: string;
  status?: string;
  checkIn?: { time?: string | Date } | null;
  checkOut?: { time?: string | Date } | null;
}
