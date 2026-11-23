import type { Db } from "mongodb";
import type {
  HealthcareNamedValue,
  HealthcareOverviewAnalytics,
} from "../../../shared/healthcare";
import { dayBounds } from "./operations";
import { records, scopeFilter, type HealthcareActor } from "./store";
import { supplyStats } from "./logistics/supply-read";

function shiftDay(day: string, deltaDays: number) {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

export function parseVndAmount(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw !== "string") return 0;
  const text = raw.trim();
  if (!text) return 0;
  const matches = text.match(/\d[\d.,\s]{2,}/g);
  if (!matches) return 0;
  let maxVal = 0;
  for (const token of matches) {
    const cleaned = token.replace(/[\s.,]/g, "");
    const value = Number(cleaned);
    if (
      Number.isFinite(value) &&
      value >= 1000 &&
      value <= 10_000_000_000 &&
      value > maxVal
    ) {
      maxVal = value;
    }
  }
  return maxVal;
}

function normalizeGender(raw: unknown): string {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "Chưa rõ";
  if (value === "nam" || value === "male" || value === "m") return "Nam";
  if (value === "nữ" || value === "nu" || value === "female" || value === "f") {
    return "Nữ";
  }
  return "Khác";
}

function classifyAgeGroup(
  dateOfBirth: unknown,
  birthYear: unknown,
  currentYear: number,
): string {
  let year = 0;
  const dob = String(dateOfBirth || "").trim();
  if (/^\d{4}/.test(dob)) {
    year = Number(dob.slice(0, 4));
  } else {
    const rawYear = String(birthYear || "").trim();
    if (/^\d{4}$/.test(rawYear)) year = Number(rawYear);
  }
  if (!Number.isFinite(year) || year < 1900 || year > currentYear) {
    return "Chưa rõ";
  }
  const age = currentYear - year;
  if (age < 18) return "Dưới 18";
  if (age <= 30) return "18–30";
  if (age <= 45) return "31–45";
  if (age <= 60) return "46–60";
  return "Trên 60";
}

function classifyPaymentStatus(
  paymentNote: unknown,
  reportPayment: unknown,
  amount: number,
): string {
  const combined = `${String(paymentNote || "").trim()} ${String(reportPayment || "").trim()}`
    .trim()
    .toLowerCase();
  if (
    combined.includes("miễn phí") ||
    combined.includes("mien phi") ||
    combined === "0" ||
    combined === "0đ" ||
    combined === "0 đ"
  ) {
    return "Miễn phí";
  }
  if (
    combined.includes("một phần") ||
    combined.includes("mot phan") ||
    combined.includes("đặt cọc") ||
    combined.includes("dat coc") ||
    combined.includes("cọc")
  ) {
    return "Thanh toán một phần";
  }
  if (
    combined.includes("chưa") ||
    combined.includes("chua") ||
    combined.includes("công nợ") ||
    combined.includes("cong no") ||
    combined.includes("nợ")
  ) {
    return "Chưa thanh toán";
  }
  if (
    amount > 0 ||
    combined.includes("đã thanh toán") ||
    combined.includes("da thanh toan") ||
    combined.includes("đã thu") ||
    combined.includes("da thu") ||
    combined.includes("hoàn tất")
  ) {
    return "Đã thanh toán";
  }
  if (!combined) return "Chưa ghi nhận";
  return "Khác";
}

function bucketKey(day: string, byMonth: boolean) {
  if (!day || day.length < 7) return "";
  return byMonth ? day.slice(0, 7) : day.slice(0, 10);
}

function formatBucketLabel(key: string, byMonth: boolean) {
  if (byMonth) {
    const [year, month] = key.split("-");
    return month && year ? `T${Number(month)}/${year.slice(-2)}` : key;
  }
  const [, month, day] = key.split("-");
  return day && month ? `${day}/${month}` : key;
}

function toVietnamDay(iso: unknown): string {
  const text = String(iso || "").trim();
  if (!text) return "";
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10);
}

const VISIT_STATUS_LABELS: Record<string, string> = {
  registered: "Đã tiếp nhận",
  in_progress: "Đang khám",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
  imported: "Nhập từ hồ sơ",
};

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  arrived: "Đã đến",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
  no_show: "Vắng mặt",
};

const CARE_STATUS_LABELS: Record<string, string> = {
  open: "Chờ xử lý",
  in_progress: "Đang xử lý",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
};

const EQUIPMENT_STATUS_LABELS: Record<string, string> = {
  available: "Sẵn sàng",
  requested: "Đang yêu cầu",
  "in-use": "Đang sử dụng",
  maintenance: "Bảo trì",
  retired: "Ngừng sử dụng",
};

const AGE_GROUP_ORDER = [
  "Dưới 18",
  "18–30",
  "31–45",
  "46–60",
  "Trên 60",
  "Chưa rõ",
] as const;

export async function buildHealthcareOverviewAnalytics(
  db: Db,
  actor: HealthcareActor,
  options: {
    today: string;
    from?: string;
    to?: string;
    previousFrom?: string;
    previousTo?: string;
    canVisits: boolean;
    canAppointments: boolean;
    canCare: boolean;
  },
): Promise<HealthcareOverviewAnalytics> {
  const scope = scopeFilter(actor);
  const from = options.from || options.today;
  const to = options.to || options.today;
  const spanDays = daysBetween(from, to);
  const prevTo = options.previousTo || shiftDay(from, -1);
  const prevFrom = options.previousFrom || shiftDay(prevTo, -(spanDays - 1));
  const byMonth = spanDays > 45;

  const periodStartIso = dayBounds(from).start;
  const periodEndIso = dayBounds(to).end;
  const prevStartIso = dayBounds(prevFrom).start;
  const prevEndIso = dayBounds(prevTo).end;
  const soonDay = shiftDay(options.today, 30);
  const currentYear = Number(options.today.slice(0, 4)) || new Date().getFullYear();

  const [
    allPatientProfiles,
    previousPatientsInPeriod,
    previousPeriodVisits,
    periodVisits,
    periodAppointments,
    previousAppointmentsInPeriod,
    totalPendingAppointments,
    careGroups,
    catalogItems,
    supplySummary,
    supplyCategoryRows,
    supplyWarehouseRows,
    warehouses,
    supplyDocsInPeriod,
    previousSupplyDocs,
    equipmentRows,
    pendingEquipmentRequests,
  ] = await Promise.all([
    records(db, "patients")
      .find(scope)
      .project<{
        _id: string;
        createdAt: string;
        dateOfBirth?: string;
        hospitalProfile?: { gender?: string; birthYear?: string };
      }>({
        _id: 1,
        createdAt: 1,
        dateOfBirth: 1,
        "hospitalProfile.gender": 1,
        "hospitalProfile.birthYear": 1,
      })
      .toArray(),
    records(db, "patients").countDocuments({
      ...scope,
      createdAt: { $gte: prevStartIso, $lt: prevEndIso },
    }),
    options.canVisits
      ? records(db, "visits")
          .find({ ...scope, visitedOn: { $gte: prevFrom, $lte: prevTo } })
          .project<{
            patientId?: string;
            paymentNote?: string;
            report?: { fields?: { thanh_toan?: string } };
          }>({
            patientId: 1,
            paymentNote: 1,
            "report.fields.thanh_toan": 1,
          })
          .toArray()
      : null,
    options.canVisits
      ? records(db, "visits")
          .find({ ...scope, visitedOn: { $gte: from, $lte: to } })
          .project({
            patientId: 1,
            visitedOn: 1,
            status: 1,
            doctorId: 1,
            doctorName: 1,
            serviceId: 1,
            paymentNote: 1,
            "report.doctor": 1,
            "report.department": 1,
            "report.service": 1,
            "report.fields.thanh_toan": 1,
            "report.fields.dich_vu_dieu_tri": 1,
            "report.fields.kieu": 1,
            "report.fields.doi_tuong_kham": 1,
            "report.fields.chan_doan": 1,
          })
          .toArray()
      : [],
    options.canAppointments
      ? records(db, "appointments")
          .find({
            ...scope,
            $or: [
              { scheduledOn: { $gte: from, $lte: to } },
              { startsAt: { $gte: periodStartIso, $lt: periodEndIso } },
            ],
          })
          .project({
            scheduledOn: 1,
            startsAt: 1,
            status: 1,
            doctorId: 1,
            doctorName: 1,
          })
          .toArray()
      : [],
    options.canAppointments
      ? records(db, "appointments").countDocuments({
          ...scope,
          $or: [
            { scheduledOn: { $gte: prevFrom, $lte: prevTo } },
            { startsAt: { $gte: prevStartIso, $lt: prevEndIso } },
          ],
        })
      : null,
    options.canAppointments
      ? records(db, "appointments").countDocuments({
          ...scope,
          status: { $in: ["scheduled", "confirmed", "arrived"] },
        })
      : 0,
    options.canCare
      ? records(db, "care")
          .aggregate<{ _id: string; count: number }>([
            { $match: scope },
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ])
          .toArray()
      : [],
    records(db, "catalog")
      .find({ ...scope, kind: { $in: ["doctor", "service"] } })
      .project<{ _id: string; kind: string; name: string }>({
        _id: 1,
        kind: 1,
        name: 1,
      })
      .toArray(),
    supplyStats(db, actor),
    db
      .collection("healthcare_supplies")
      .aggregate<{
        _id: string;
        count: number;
        quantity: number;
        value: number;
        outOfStock: number;
      }>([
        { $match: { ...scope, active: true } },
        {
          $lookup: {
            from: "healthcare_supply_balances",
            let: { id: "$_id" },
            pipeline: [
              { $match: { ...scope, $expr: { $eq: ["$supplyId", "$$id"] } } },
            ],
            as: "balances",
          },
        },
        {
          $set: {
            quantity: { $sum: "$balances.quantity" },
            stockValue: { $sum: "$balances.value" },
          },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $gt: [{ $strLenCP: { $ifNull: ["$category", ""] } }, 0] },
                "$category",
                "Chưa phân loại",
              ],
            },
            count: { $sum: 1 },
            quantity: { $sum: "$quantity" },
            value: { $sum: "$stockValue" },
            outOfStock: {
              $sum: { $cond: [{ $lte: ["$quantity", 0] }, 1, 0] },
            },
          },
        },
        { $sort: { value: -1, quantity: -1, _id: 1 } },
      ])
      .toArray(),
    db
      .collection("healthcare_supply_balances")
      .aggregate<{ _id: string; quantity: number; value: number }>([
        { $match: { ...scope, quantity: { $gt: 0 } } },
        {
          $group: {
            _id: "$warehouseId",
            quantity: { $sum: "$quantity" },
            value: { $sum: "$value" },
          },
        },
        { $sort: { value: -1, quantity: -1 } },
      ])
      .toArray(),
    db
      .collection("warehouses")
      .find(scope)
      .project<{ _id: unknown; name?: string }>({ _id: 1, name: 1 })
      .toArray(),
    db
      .collection("healthcare_supply_documents")
      .find({
        ...scope,
        status: "posted",
        type: { $in: ["receipt", "issue"] },
        $or: [
          { voucherDay: { $gte: from, $lte: to } },
          {
            voucherDay: { $in: ["", null] },
            createdAt: { $gte: periodStartIso, $lt: periodEndIso },
          },
        ],
      })
      .project<{
        type: "receipt" | "issue";
        voucherDay?: string;
        createdAt: string;
        lines?: Array<{ value?: number }>;
      }>({ type: 1, voucherDay: 1, createdAt: 1, lines: 1 })
      .toArray(),
    db
      .collection("healthcare_supply_documents")
      .find({
        ...scope,
        status: "posted",
        type: { $in: ["receipt", "issue"] },
        $or: [
          { voucherDay: { $gte: prevFrom, $lte: prevTo } },
          {
            voucherDay: { $in: ["", null] },
            createdAt: { $gte: prevStartIso, $lt: prevEndIso },
          },
        ],
      })
      .project<{
        type: "receipt" | "issue";
        lines?: Array<{ value?: number }>;
      }>({ type: 1, lines: 1 })
      .toArray(),
    db
      .collection("healthcare_equipment")
      .find({ ...scope, deletedAt: { $exists: false } })
      .project<{ status: string; category?: string; nextInspectionDay?: string }>({
        status: 1,
        category: 1,
        nextInspectionDay: 1,
      })
      .toArray(),
    db.collection("healthcare_equipment_requests").countDocuments({
      ...scope,
      status: "pending",
    }),
  ]);

  const doctorNameMap = new Map<string, string>();
  const serviceNameMap = new Map<string, string>();
  for (const item of catalogItems) {
    if (item.kind === "doctor") doctorNameMap.set(item._id, item.name);
    else if (item.kind === "service") serviceNameMap.set(item._id, item.name);
  }
  const warehouseNameMap = new Map(
    warehouses.map((w) => [String(w._id), String(w.name || "Kho khác")]),
  );

  // Patient demographics & new patient trend
  const genderCounts = new Map<string, number>();
  const ageGroupCounts = new Map<string, number>();
  const newPatientIdsInPeriod = new Set<string>();
  const trendMap = new Map<
    string,
    { visits: number; appointments: number; newPatients: number; visitPayment: number }
  >();
  let newPatientsInPeriod = 0;

  for (const patient of allPatientProfiles) {
    const gender = normalizeGender(patient.hospitalProfile?.gender);
    genderCounts.set(gender, (genderCounts.get(gender) || 0) + 1);

    const ageGroup = classifyAgeGroup(
      patient.dateOfBirth,
      patient.hospitalProfile?.birthYear,
      currentYear,
    );
    ageGroupCounts.set(ageGroup, (ageGroupCounts.get(ageGroup) || 0) + 1);

    if (patient.createdAt >= periodStartIso && patient.createdAt < periodEndIso) {
      newPatientsInPeriod += 1;
      newPatientIdsInPeriod.add(patient._id);
      const day = toVietnamDay(patient.createdAt);
      const key = bucketKey(day, byMonth);
      if (key) {
        const entry = trendMap.get(key) || {
          visits: 0,
          appointments: 0,
          newPatients: 0,
          visitPayment: 0,
        };
        entry.newPatients += 1;
        trendMap.set(key, entry);
      }
    }
  }

  const patientsByGender = [...genderCounts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const patientsByAgeGroup = AGE_GROUP_ORDER.map((name) => ({
    name,
    value: ageGroupCounts.get(name) || 0,
  })).filter((row) => row.value > 0);

  // Previous period visit metrics
  let previousVisitCount: number | null = null;
  let previousUniquePatientsVisited: number | null = null;
  let previousVisitPaymentTotal: number | null = null;
  if (previousPeriodVisits !== null) {
    previousVisitCount = previousPeriodVisits.length;
    const prevUnique = new Set<string>();
    let prevPay = 0;
    for (const visit of previousPeriodVisits) {
      if (visit.patientId) prevUnique.add(visit.patientId);
      prevPay +=
        parseVndAmount(visit.paymentNote) ||
        parseVndAmount(visit.report?.fields?.thanh_toan);
    }
    previousUniquePatientsVisited = prevUnique.size;
    previousVisitPaymentTotal = Math.round(prevPay);
  }

  // Visits breakdown, trend, doctors, departments, services, diagnoses, payment
  const visitStatusCounts = new Map<string, number>();
  const doctorStats = new Map<string, { value: number; amount: number }>();
  const deptCounts = new Map<string, number>();
  const serviceStats = new Map<string, { value: number; amount: number }>();
  const customerTypeCounts = new Map<string, number>();
  const diagnosisCounts = new Map<string, number>();
  const patientTypeCounts = new Map<string, number>();
  const paymentStatusCounts = new Map<string, number>();
  const uniquePatientsInVisits = new Set<string>();
  const stockFlowMap = new Map<
    string,
    { receiptValue: number; issueValue: number; visitPayment: number }
  >();

  let visitPaymentTotal = 0;
  let paidVisitCount = 0;
  let unpaidVisitCount = 0;

  for (const visit of periodVisits as Array<any>) {
    if (visit.patientId) uniquePatientsInVisits.add(String(visit.patientId));

    const status = String(visit.status || "registered");
    visitStatusCounts.set(status, (visitStatusCounts.get(status) || 0) + 1);

    const amount =
      parseVndAmount(visit.paymentNote) ||
      parseVndAmount(visit.report?.fields?.thanh_toan);

    const paymentStatus = classifyPaymentStatus(
      visit.paymentNote,
      visit.report?.fields?.thanh_toan,
      amount,
    );
    paymentStatusCounts.set(
      paymentStatus,
      (paymentStatusCounts.get(paymentStatus) || 0) + 1,
    );

    if (amount > 0 || paymentStatus === "Đã thanh toán") {
      visitPaymentTotal += amount;
      paidVisitCount += 1;
    } else if (paymentStatus === "Chưa thanh toán") {
      unpaidVisitCount += 1;
    }

    const key = bucketKey(String(visit.visitedOn || ""), byMonth);
    if (key) {
      const entry = trendMap.get(key) || {
        visits: 0,
        appointments: 0,
        newPatients: 0,
        visitPayment: 0,
      };
      entry.visits += 1;
      entry.visitPayment += amount;
      trendMap.set(key, entry);

      if (amount > 0) {
        const flow = stockFlowMap.get(key) || {
          receiptValue: 0,
          issueValue: 0,
          visitPayment: 0,
        };
        flow.visitPayment += amount;
        stockFlowMap.set(key, flow);
      }
    }

    const docLabel =
      (visit.doctorId && doctorNameMap.get(visit.doctorId)) ||
      String(visit.doctorName || "").trim() ||
      String(visit.report?.doctor || "").trim();
    if (docLabel) {
      const curr = doctorStats.get(docLabel) || { value: 0, amount: 0 };
      curr.value += 1;
      curr.amount += amount;
      doctorStats.set(docLabel, curr);
    }

    const deptLabel = String(visit.report?.department || "").trim();
    if (deptLabel) {
      deptCounts.set(deptLabel, (deptCounts.get(deptLabel) || 0) + 1);
    }

    const serviceLabel =
      (visit.serviceId && serviceNameMap.get(visit.serviceId)) ||
      String(visit.report?.service || "").trim() ||
      String(visit.report?.fields?.dich_vu_dieu_tri || "").trim();
    if (serviceLabel) {
      const curr = serviceStats.get(serviceLabel) || { value: 0, amount: 0 };
      curr.value += 1;
      curr.amount += amount;
      serviceStats.set(serviceLabel, curr);
    }

    const customerType = String(visit.report?.fields?.doi_tuong_kham || "").trim();
    if (customerType) {
      customerTypeCounts.set(
        customerType,
        (customerTypeCounts.get(customerType) || 0) + 1,
      );
    }

    const diagnosis = String(visit.report?.fields?.chan_doan || "").trim();
    if (diagnosis) {
      diagnosisCounts.set(diagnosis, (diagnosisCounts.get(diagnosis) || 0) + 1);
    }

    const rawPatientType = String(visit.report?.fields?.kieu || "").trim();
    const visitPatientType =
      rawPatientType ||
      (visit.patientId && newPatientIdsInPeriod.has(String(visit.patientId))
        ? "Khách mới"
        : "Tái khám");
    patientTypeCounts.set(
      visitPatientType,
      (patientTypeCounts.get(visitPatientType) || 0) + 1,
    );
  }

  // Appointments breakdown, trend & doctors
  const appointmentStatusCounts = new Map<string, number>();
  const appointmentDoctorCounts = new Map<string, number>();
  for (const appt of periodAppointments as Array<any>) {
    const status = String(appt.status || "scheduled");
    appointmentStatusCounts.set(status, (appointmentStatusCounts.get(status) || 0) + 1);

    const docLabel =
      (appt.doctorId && doctorNameMap.get(appt.doctorId)) ||
      String(appt.doctorName || "").trim();
    if (docLabel) {
      appointmentDoctorCounts.set(
        docLabel,
        (appointmentDoctorCounts.get(docLabel) || 0) + 1,
      );
    }

    const day =
      String(appt.scheduledOn || "").slice(0, 10) || toVietnamDay(appt.startsAt);
    const key = bucketKey(day, byMonth);
    if (key) {
      const entry = trendMap.get(key) || {
        visits: 0,
        appointments: 0,
        newPatients: 0,
        visitPayment: 0,
      };
      entry.appointments += 1;
      trendMap.set(key, entry);
    }
  }

  const visitTrend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([key, row]) => ({
      label: formatBucketLabel(key, byMonth),
      visits: row.visits,
      appointments: row.appointments,
      newPatients: row.newPatients,
      visitPayment: Math.round(row.visitPayment),
    }));

  const toRanked = (map: Map<string, number>, limit = 8): HealthcareNamedValue[] =>
    [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);

  const visitsInPeriodByStatus = [...visitStatusCounts.entries()]
    .map(([status, value]) => ({ name: VISIT_STATUS_LABELS[status] || status, value }))
    .sort((a, b) => b.value - a.value);

  const visitsByDoctor: HealthcareNamedValue[] = [...doctorStats.entries()]
    .map(([name, stat]) => ({
      name,
      value: stat.value,
      ...(stat.amount > 0 ? { amount: Math.round(stat.amount) } : {}),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const visitsByDepartment = toRanked(deptCounts, 8);

  const visitsByService: HealthcareNamedValue[] = [...serviceStats.entries()]
    .map(([name, stat]) => ({
      name,
      value: stat.value,
      ...(stat.amount > 0 ? { amount: Math.round(stat.amount) } : {}),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const visitsByCustomerType = toRanked(customerTypeCounts, 8);
  const topDiagnoses = toRanked(diagnosisCounts, 8);
  const patientVisitType = toRanked(patientTypeCounts, 6);
  const paymentStatusBreakdown = toRanked(paymentStatusCounts, 6);

  const appointmentByStatus = [...appointmentStatusCounts.entries()]
    .map(([status, value]) => ({
      name: APPOINTMENT_STATUS_LABELS[status] || status,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  const appointmentsByDoctor = toRanked(appointmentDoctorCounts, 8);

  const careByStatus = careGroups
    .filter((row) => row.count > 0)
    .map((row) => ({ name: CARE_STATUS_LABELS[row._id] || row._id, value: row.count }))
    .sort((a, b) => b.value - a.value);
  let careTotal = 0;
  let careCompletedCount = 0;
  for (const row of careGroups) {
    careTotal += row.count;
    if (row._id === "completed") careCompletedCount += row.count;
  }
  const careCompletionRate =
    careTotal > 0 ? Math.round((careCompletedCount / careTotal) * 1000) / 10 : null;

  // Stock cashflow (receipt vs issue)
  let receiptValue = 0;
  let issueValue = 0;
  let receiptCount = 0;
  let issueCount = 0;

  for (const doc of supplyDocsInPeriod) {
    const docValue = (doc.lines || []).reduce(
      (sum, line) => sum + Math.max(0, Number(line?.value) || 0),
      0,
    );
    const day =
      (doc.voucherDay && doc.voucherDay.slice(0, 10)) || toVietnamDay(doc.createdAt);
    const key = bucketKey(day, byMonth);
    const entry = stockFlowMap.get(key) || {
      receiptValue: 0,
      issueValue: 0,
      visitPayment: 0,
    };
    if (doc.type === "receipt") {
      receiptValue += docValue;
      receiptCount += 1;
      entry.receiptValue += docValue;
    } else if (doc.type === "issue") {
      issueValue += docValue;
      issueCount += 1;
      entry.issueValue += docValue;
    }
    if (key) stockFlowMap.set(key, entry);
  }

  let previousReceiptValue = 0;
  let previousIssueValue = 0;
  for (const doc of previousSupplyDocs) {
    const docValue = (doc.lines || []).reduce(
      (sum, line) => sum + Math.max(0, Number(line?.value) || 0),
      0,
    );
    if (doc.type === "receipt") previousReceiptValue += docValue;
    else if (doc.type === "issue") previousIssueValue += docValue;
  }

  const stockFlowTrend = [...stockFlowMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([key, row]) => ({
      label: formatBucketLabel(key, byMonth),
      receiptValue: Math.round(row.receiptValue),
      issueValue: Math.round(row.issueValue),
      visitPayment: Math.round(row.visitPayment),
    }));

  const outOfStock = supplyCategoryRows.reduce(
    (sum, row) => sum + (row.outOfStock || 0),
    0,
  );
  const totalItems = Number(supplySummary.totalItems || 0);
  const lowAndOut = Number(supplySummary.lowStock || 0);
  const lowOnly = Math.max(0, lowAndOut - outOfStock);
  const inStock = Math.max(0, totalItems - lowAndOut);

  const byWarehouse = supplyWarehouseRows.slice(0, 8).map((row) => ({
    name: warehouseNameMap.get(String(row._id)) || "Kho mặc định",
    quantity: Math.round(row.quantity * 100) / 100,
    value: Math.round(row.value),
  }));

  // Equipment breakdown
  const equipStatusCounts = new Map<string, number>();
  const equipCategoryCounts = new Map<string, number>();
  let overdueInspection = 0;
  let soonInspection = 0;
  for (const item of equipmentRows) {
    const status = String(item.status || "available");
    equipStatusCounts.set(status, (equipStatusCounts.get(status) || 0) + 1);
    const cat = String(item.category || "").trim() || "Chưa phân loại";
    equipCategoryCounts.set(cat, (equipCategoryCounts.get(cat) || 0) + 1);
    const nextDay = String(item.nextInspectionDay || "");
    if (nextDay) {
      if (nextDay < options.today) overdueInspection += 1;
      else if (nextDay <= soonDay) soonInspection += 1;
    }
  }
  const equipmentByStatus = [...equipStatusCounts.entries()]
    .map(([status, value]) => ({
      name: EQUIPMENT_STATUS_LABELS[status] || status,
      value,
    }))
    .sort((a, b) => b.value - a.value);
  const equipmentByCategory = toRanked(equipCategoryCounts, 8);

  const averageVisitPayment =
    paidVisitCount > 0 && visitPaymentTotal > 0
      ? Math.round(visitPaymentTotal / paidVisitCount)
      : 0;

  return {
    newPatientsInPeriod,
    previousPatientsInPeriod,
    uniquePatientsVisited: uniquePatientsInVisits.size,
    previousUniquePatientsVisited,
    patientsByGender,
    patientsByAgeGroup,
    patientVisitType,
    previousVisitCount,
    visitsInPeriodByStatus,
    visitTrend,
    visitsByDoctor,
    visitsByDepartment,
    visitsByService,
    visitsByCustomerType,
    topDiagnoses,
    appointmentsInPeriod: periodAppointments.length,
    previousAppointmentsInPeriod,
    totalPendingAppointments,
    appointmentByStatus,
    appointmentsByDoctor,
    careByStatus,
    careTotal,
    careCompletedCount,
    careCompletionRate,
    finance: {
      visitPaymentTotal: Math.round(visitPaymentTotal),
      previousVisitPaymentTotal,
      paidVisitCount,
      unpaidVisitCount,
      averageVisitPayment,
      paymentStatusBreakdown,
      receiptValue: Math.round(receiptValue),
      previousReceiptValue: Math.round(previousReceiptValue),
      issueValue: Math.round(issueValue),
      previousIssueValue: Math.round(previousIssueValue),
      receiptCount,
      issueCount,
      stockFlowTrend,
    },
    inventory: {
      totalItems,
      totalQuantity: Number(supplySummary.totalQuantity || 0),
      totalValue: Math.round(Number(supplySummary.totalValue || 0)),
      inStock,
      lowStock: lowOnly,
      outOfStock,
      expired: Number(supplySummary.expired || 0),
      expiringSoon: Number(supplySummary.expiringSoon || 0),
      byCategory: supplyCategoryRows.slice(0, 8).map((row) => ({
        name: row._id,
        count: row.count,
        quantity: Math.round(row.quantity * 100) / 100,
        value: Math.round(row.value),
      })),
      byWarehouse,
    },
    equipment: {
      total: equipmentRows.length,
      byStatus: equipmentByStatus,
      byCategory: equipmentByCategory,
      overdueInspection,
      soonInspection,
      pendingRequests: pendingEquipmentRequests,
    },
  };
}
