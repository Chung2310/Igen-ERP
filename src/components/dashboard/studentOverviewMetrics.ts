import type { Batch, Course, Student } from "../../modules/student-management/types";
import { overviewDateKey } from "./overviewComparison";

export type StudentOverviewRange = { from: string; to: string; previousFrom: string; previousTo: string };
type NamedValue = { name: string; value: number };
type TuitionCourse = { name: string; total: number; paid: number; outstanding: number };

const integer = (value: number) => Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
export const parseStudentFee = (value: string | undefined) => {
  const digits = String(value || "").replace(/\D/g, "");
  const amount = Number(digits);
  return digits && Number.isSafeInteger(amount) ? amount : null;
};

const paidFor = (student: Student) => {
  const history = student.paymentHistory || [];
  return integer(history.length ? history.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0) : Number(student.paidAmount || 0));
};

function topGroups(rows: NamedValue[], limit = 6): NamedValue[] {
  const sorted = rows.filter(row => row.value > 0).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "vi"));
  if (sorted.length <= limit) return sorted;
  return [...sorted.slice(0, limit), { name: "Khác", value: sorted.slice(limit).reduce((sum, row) => sum + row.value, 0) }];
}

function dateBuckets(from: string, to: string) {
  const first = new Date(`${from}T12:00:00Z`);
  const last = new Date(`${to}T12:00:00Z`);
  const days = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
  const kind = days > 120 ? "month" : days > 31 ? "week" : "day";
  const buckets: Array<{ key: string; label: string; from: string; to: string; registrations: number; collected: number }> = [];
  if (kind === "month") {
    const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
    while (cursor <= last) {
      const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth();
      const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
      buckets.push({ key: start, label: `${String(month + 1).padStart(2, "0")}/${year}`, from: start < from ? from : start, to: end > to ? to : end, registrations: 0, collected: 0 });
      cursor.setUTCMonth(month + 1);
    }
  } else {
    for (let offset = 0; offset < days; offset += kind === "week" ? 7 : 1) {
      const start = new Date(first);
      start.setUTCDate(start.getUTCDate() + offset);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + (kind === "week" ? 6 : 0));
      const startKey = start.toISOString().slice(0, 10);
      const endKey = end.toISOString().slice(0, 10);
      buckets.push({ key: startKey, label: kind === "week" ? `${startKey.slice(8, 10)}/${startKey.slice(5, 7)}` : `${startKey.slice(8, 10)}/${startKey.slice(5, 7)}`, from: startKey, to: endKey > to ? to : endKey, registrations: 0, collected: 0 });
    }
  }
  return buckets;
}

export function buildStudentOverview(students: Student[], courses: Course[], batches: Batch[], range: StudentOverviewRange) {
  const courseNames = new Map(courses.map(course => [String(course.id), course.title]));
  const batchCourse = new Map<string, string>();
  for (const batch of batches) for (const studentId of batch.learnerIds || []) {
    if (!batchCourse.has(String(studentId))) batchCourse.set(String(studentId), courseNames.get(String(batch.courseId)) || batch.courseTitle || "Chưa xếp khóa học");
  }
  const courseName = (student: Student) => courseNames.get(String(student.courseId || "")) || batchCourse.get(String(student.id)) || "Chưa xếp khóa học";
  const inRange = (date: string | null, from: string, to: string) => Boolean(date && date >= from && date <= to);
  const registrations = students.filter(student => inRange(overviewDateKey(student.registrationDate), range.from, range.to));
  const previousRegistrations = students.filter(student => inRange(overviewDateKey(student.registrationDate), range.previousFrom, range.previousTo));
  const buckets = dateBuckets(range.from, range.to);
  const status = new Map<string, number>();
  const course = new Map<string, number>();
  const referral = new Map<string, number>();
  const courseMoney = new Map<string, TuitionCourse>();
  const payments: Array<{ date: string; amount: number; method: string }> = [];
  const debts: Array<{ id: string; name: string; course: string; outstanding: number }> = [];
  let totalFee = 0, totalPaid = 0, outstanding = 0, feeKnown = 0, studying = 0, graduated = 0;

  for (const student of students) {
    const registrationDate = overviewDateKey(student.registrationDate);
    if (inRange(registrationDate, range.from, range.to)) {
      const bucket = buckets.find(item => registrationDate! >= item.from && registrationDate! <= item.to);
      if (bucket) bucket.registrations++;
    }
    const primaryStatus = Array.isArray(student.status) ? student.status[0] : student.status;
    const statusName = primaryStatus || "Chưa cập nhật";
    status.set(statusName, (status.get(statusName) || 0) + 1);
    if (Array.isArray(student.status) && student.status.includes("Đang học")) studying++;
    if (Array.isArray(student.status) && student.status.includes("Đã đậu")) graduated++;
    const name = courseName(student);
    course.set(name, (course.get(name) || 0) + 1);
    const source = student.referral?.trim() || "Trực tiếp / chưa rõ";
    referral.set(source, (referral.get(source) || 0) + 1);

    const fee = parseStudentFee(student.fee);
    const paid = paidFor(student);
    if (fee !== null) {
      feeKnown++;
      const due = Math.max(0, fee - paid);
      totalFee += fee;
      totalPaid += paid;
      outstanding += due;
      if (due > 0) debts.push({ id: student.id, name: student.fullName, course: name, outstanding: due });
      const group = courseMoney.get(name) || { name, total: 0, paid: 0, outstanding: 0 };
      group.total += fee; group.paid += paid; group.outstanding += due;
      courseMoney.set(name, group);
    }
    for (const payment of student.paymentHistory || []) {
      const date = overviewDateKey(payment.date);
      const amount = Number(payment.amount);
      if (!date || !Number.isFinite(amount) || amount <= 0) continue;
      payments.push({ date, amount, method: payment.method || "Chưa rõ" });
      if (inRange(date, range.from, range.to)) {
        const bucket = buckets.find(item => date >= item.from && date <= item.to);
        if (bucket) bucket.collected += amount;
      }
    }
  }

  const currentPayments = payments.filter(payment => inRange(payment.date, range.from, range.to));
  const previousPayments = payments.filter(payment => inRange(payment.date, range.previousFrom, range.previousTo));
  const paymentMethods = new Map<string, number>();
  for (const payment of currentPayments) paymentMethods.set(payment.method, (paymentMethods.get(payment.method) || 0) + payment.amount);
  const activeBatches = batches.filter(batch => batch.status === "Đang học" || batch.status === "Sắp khai giảng");
  const batchLoad = activeBatches.map(batch => ({ name: batch.name || batch.code || "Lớp học", learners: batch.learnerIds?.length || 0, capacity: Math.max(0, Number(batch.quota || batch.maxLearners || 0)) }))
    .sort((a, b) => b.learners - a.learners).slice(0, 8);

  return {
    counts: { students: students.length, registrations: registrations.length, previousRegistrations: previousRegistrations.length, studying, graduated, activeBatches: activeBatches.length, courses: courses.length, debtors: debts.length, feeKnown },
    tuition: { totalFee, totalPaid, outstanding, collectedInPeriod: currentPayments.reduce((sum, payment) => sum + payment.amount, 0), previousCollected: previousPayments.reduce((sum, payment) => sum + payment.amount, 0) },
    trend: buckets,
    status: topGroups([...status].map(([name, value]) => ({ name, value }))),
    courses: topGroups([...course].map(([name, value]) => ({ name, value }))),
    referral: topGroups([...referral].map(([name, value]) => ({ name, value }))),
    tuitionByCourse: [...courseMoney.values()].sort((a, b) => b.total - a.total).slice(0, 7),
    paymentMethods: [...paymentMethods].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    batchLoad,
    debts: debts.sort((a, b) => b.outstanding - a.outstanding).slice(0, 6),
  };
}
