import { AssignmentModel } from "../models/assignment.model";
import { Batch } from "../models/batch.model";
import { BatchMiniTest } from "../models/batch-mini-test.model";
import { Course } from "../models/course.model";
import { Student } from "../models/student.model";
import { BatchEnrollment } from "../models/batch-enrollment.model";
import { StudentQualityRecord } from "../models/student-quality.model";
import { StudentQualityThreshold } from "../models/student-quality-threshold.model";
import { SubmissionModel } from "../models/submission.model";
import { resolveOwnerFilter } from "../utils/auth.util";
import { listScheduledSessionDates, todayInVietnam } from "../utils/session-count.util";
import { DEFAULT_QUALITY_THRESHOLDS, getQualityWarningLevel, toRate, type QualityThresholds, type QualityWarningLevel } from "./student-quality.rules";

type OwnerScope = string | string[];

interface QualityFilters {
  page?: number | string;
  limit?: number | string;
  search?: string;
  batchId?: string;
  courseId?: string;
  instructorId?: string;
  studentStatus?: string;
  warningLevel?: QualityWarningLevel;
  ownerFilter?: string;
}

interface QualityActor { uid: string; branchId?: string; }
interface QualityPair { batchId: string; studentId: string; }

function ownerQuery(ownerId: OwnerScope): Record<string, unknown> {
  return ownerId === "ALL" ? {} : { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
}

function branchQuery(branchId?: string): Record<string, unknown> { return branchId ? { branchId } : {}; }

function parseDateValue(date?: string): number {
  if (!date) return 0;
  const parsed = Date.parse(date);
  if (!Number.isNaN(parsed)) return parsed;
  const match = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : 0;
}

function latestByDate<T extends { date?: string }>(items: T[]): T | undefined {
  return [...items].sort((left, right) => parseDateValue(right.date) - parseDateValue(left.date))[0];
}

function isExamFailed(exam?: { status?: string; result?: unknown }): boolean {
  if (!exam) return false;
  const result = exam.result as { overall?: unknown } | undefined;
  const value = String(result?.overall || exam.status || "").trim().toLocaleLowerCase("vi-VN");
  return value === "trượt" || value === "fail" || value === "failed";
}

export class StudentQualityService {
  static async getThresholds(ownerId: OwnerScope, branchId?: string): Promise<QualityThresholds> {
    if (ownerId === "ALL") return DEFAULT_QUALITY_THRESHOLDS;
    const settingsOwnerId = Array.isArray(ownerId) ? ownerId[0] : ownerId;
    if (!settingsOwnerId) return DEFAULT_QUALITY_THRESHOLDS;
    const settings = await StudentQualityThreshold.findOne({ ownerId: settingsOwnerId, ...branchQuery(branchId) }).lean();
    return settings ? {
      riskAttendance: settings.riskAttendance, riskAssignment: settings.riskAssignment, riskMiniTest: settings.riskMiniTest,
      watchAttendance: settings.watchAttendance, watchAssignment: settings.watchAssignment, watchMiniTest: settings.watchMiniTest,
      assignmentMaxScore: settings.assignmentMaxScore || DEFAULT_QUALITY_THRESHOLDS.assignmentMaxScore,
    } : DEFAULT_QUALITY_THRESHOLDS;
  }

  static async updateThresholds(ownerId: OwnerScope, branchId: string | undefined, data: QualityThresholds) {
    if (ownerId === "ALL") throw new Error("Hãy chọn một đơn vị cụ thể để cập nhật ngưỡng đánh giá.");
    const settingsOwnerId = Array.isArray(ownerId) ? ownerId[0] : ownerId;
    if (!settingsOwnerId) throw new Error("Không xác định được đơn vị để cập nhật ngưỡng đánh giá.");
    if (data.riskAttendance > data.watchAttendance || data.riskAssignment > data.watchAssignment || data.riskMiniTest > data.watchMiniTest) throw new Error("Ngưỡng cần can thiệp phải nhỏ hơn hoặc bằng ngưỡng cần theo dõi.");
    await StudentQualityThreshold.findOneAndUpdate({ ownerId: settingsOwnerId, ...branchQuery(branchId) }, { $set: data, $setOnInsert: { ownerId: settingsOwnerId, branchId } }, { upsert: true });
    return data;
  }

  private static async resolveRows(ownerId: OwnerScope, filters: QualityFilters, branchId?: string) {
    const resolvedOwnerId = await resolveOwnerFilter(ownerId, filters.ownerFilter);
    const batchFilter: Record<string, unknown> = { ...ownerQuery(resolvedOwnerId), ...branchQuery(branchId) };
    if (filters.batchId) batchFilter._id = filters.batchId;
    if (filters.courseId) batchFilter.courseId = filters.courseId;
    if (filters.instructorId) batchFilter.instructorId = filters.instructorId;

    const thresholds = await this.getThresholds(resolvedOwnerId, branchId);
    const batches = await Batch.find(batchFilter).lean();
    if (!batches.length) return { rows: [], resolvedOwnerId };

    const batchIds = batches.map((batch) => String(batch._id));
    const enrollments = await BatchEnrollment.find({
      ...ownerQuery(resolvedOwnerId), ...branchQuery(branchId), batchId: { $in: batchIds }, status: { $in: ["Đang học", "Học lại"] },
    }).lean();
    const pairs: QualityPair[] = [];
    const pairKeys = new Set<string>();
    const addPair = (batchId: string, studentId: string) => {
      const key = `${batchId}:${studentId}`;
      if (!pairKeys.has(key)) { pairKeys.add(key); pairs.push({ batchId, studentId }); }
    };
    for (const batch of batches) for (const studentId of batch.learnerIds || []) addPair(String(batch._id), studentId);
    for (const enrollment of enrollments) addPair(enrollment.batchId, enrollment.studentId);

    const studentIds = [...new Set(pairs.map((pair) => pair.studentId))];
    const students = await Student.find({ _id: { $in: studentIds }, ...ownerQuery(resolvedOwnerId), ...branchQuery(branchId) }).lean();
    const studentMap = new Map(students.map((student) => [String(student._id), student]));
    const batchMap = new Map(batches.map((batch) => [String(batch._id), batch]));
    const filteredPairs = pairs.filter(({ studentId }) => {
      const student = studentMap.get(studentId);
      if (!student) return false;
      if (filters.studentStatus && !(student.status || []).includes(filters.studentStatus as typeof student.status[number])) return false;
      const term = filters.search?.trim().toLowerCase();
      return !term || student.fullName.toLowerCase().includes(term) || student.phone.includes(term);
    });

    const courseIds = [...new Set(batches.map((batch) => batch.courseId).filter(Boolean))];
    const [courses, assignments, qualityRecords, batchMiniTests] = await Promise.all([
      Course.find({ _id: { $in: courseIds }, ...ownerQuery(resolvedOwnerId), ...branchQuery(branchId) }).lean(),
      AssignmentModel.find({ batchId: { $in: batchIds }, ...ownerQuery(resolvedOwnerId), ...branchQuery(branchId) }).lean(),
      StudentQualityRecord.find({ ...ownerQuery(resolvedOwnerId), ...branchQuery(branchId), batchId: { $in: batchIds }, studentId: { $in: studentIds } }).lean(),
      BatchMiniTest.find({ ...ownerQuery(resolvedOwnerId), ...branchQuery(branchId), batchId: { $in: batchIds } }).lean(),
    ]);
    const assignmentIds = assignments.map((assignment) => String(assignment._id));
    const submissions = assignmentIds.length ? await SubmissionModel.find({ assignmentId: { $in: assignmentIds }, studentId: { $in: studentIds } }).lean() : [];
    const courseMap = new Map(courses.map((course) => [String(course._id), course]));
    const assignmentsByBatch = new Map<string, typeof assignments>();
    for (const assignment of assignments) {
      const list = assignmentsByBatch.get(assignment.batchId) || [];
      list.push(assignment); assignmentsByBatch.set(assignment.batchId, list);
    }
    const submissionMap = new Map(submissions.map((submission) => [`${submission.assignmentId}:${submission.studentId}`, submission]));
    const qualityMap = new Map(qualityRecords.map((record) => [`${record.batchId}:${record.studentId}`, record]));
    const miniTestsByBatch = new Map<string, typeof batchMiniTests>();
    for (const miniTest of batchMiniTests) {
      const list = miniTestsByBatch.get(miniTest.batchId) || [];
      list.push(miniTest); miniTestsByBatch.set(miniTest.batchId, list);
    }

    const today = todayInVietnam();
    const rows = filteredPairs.map(({ batchId, studentId }) => {
      const batch = batchMap.get(batchId)!;
      const student = studentMap.get(studentId)!;
      const scheduledPastDates = new Set(listScheduledSessionDates(batch.startDate, batch.endDate, batch.daysOfWeek || []).filter((date) => date < today));
      // Chỉ buổi đã lưu sổ điểm danh mới được dùng để đo chuyên cần.
      const confirmedSessions = (batch.attendanceSessions || []).filter((session) => scheduledPastDates.has(session.date) && session.records.length > 0);
      const confirmedDates = new Set(confirmedSessions.map((session) => session.date));
      const missingAttendanceSessions = Math.max(0, scheduledPastDates.size - confirmedDates.size);
      const attendedSessions = confirmedSessions.filter((session) => session.records.some((record) => record.studentId === studentId && (record.status === "present" || record.status === "late"))).length;
      const absentSessions = confirmedSessions.filter((session) => session.records.some((record) => record.studentId === studentId && record.status === "absent")).length;
      const lateSessions = confirmedSessions.filter((session) => session.records.some((record) => record.studentId === studentId && record.status === "late")).length;
      const assignmentItems = (assignmentsByBatch.get(batchId) || []).map((assignment) => {
        const submission = submissionMap.get(`${String(assignment._id)}:${studentId}`);
        return { id: String(assignment._id), title: assignment.title, dueDate: assignment.dueDate || null, maxScore: assignment.maxScore || DEFAULT_QUALITY_THRESHOLDS.assignmentMaxScore, status: submission?.status || "not_submitted", score: submission?.score ?? null, feedback: submission?.feedback || "", submittedAt: submission?.submittedAt || null };
      });
      const completedAssignments = assignmentItems.filter((assignment) => assignment.status !== "not_submitted").length;
      const miniTests = (miniTestsByBatch.get(batchId) || []).map((miniTest) => {
        const result = miniTest.results.find((entry) => entry.studentId === studentId);
        const score = result?.score ?? null;
        return { id: String(miniTest._id), title: miniTest.title, date: miniTest.date, maxScore: miniTest.maxScore, score, note: result?.note || "", assessedBy: result?.assessedBy || "", assessedAt: result?.assessedAt || null, rate: score === null ? null : toRate(score, miniTest.maxScore) };
      });
      const latestMiniTest = latestByDate(miniTests.filter((miniTest) => miniTest.score !== null));
      const examResults = [...((student.exams || []) as Array<{ id?: string; date?: string; name?: string; type?: string; status?: string; result?: unknown }>)].sort((left, right) => parseDateValue(right.date) - parseDateValue(left.date));
      const latestExam = latestByDate(examResults);
      const attendanceRate = toRate(attendedSessions, confirmedSessions.length);
      const assignmentRate = toRate(completedAssignments, assignmentItems.length);
      const miniTestRate = latestMiniTest?.rate ?? null;
      const quality = qualityMap.get(`${batchId}:${studentId}`);
      return {
        id: `${batchId}:${studentId}`, batchId, batchCode: batch.code, courseId: batch.courseId,
        courseTitle: courseMap.get(batch.courseId)?.title || "(Khóa học đã xóa)", instructorId: batch.instructorId || "", instructorName: batch.instructorText || "",
        studentId, studentName: student.fullName, studentPhone: student.phone, studentStatus: student.status || [],
        attendance: { attended: attendedSessions, total: confirmedSessions.length, scheduledPast: scheduledPastDates.size, missingAttendanceSessions, absent: absentSessions, late: lateSessions, rate: attendanceRate },
        assignments: { completed: completedAssignments, total: assignmentItems.length, rate: assignmentRate, items: assignmentItems },
        attitudeNote: quality?.attitudeNote || "", teacherAssessment: quality?.teacherAssessment || "",
        latestMiniTest: latestMiniTest ? { ...latestMiniTest, title: `${latestMiniTest.title}${miniTests.filter((miniTest) => miniTest.score !== null).length > 1 ? ` · ${miniTests.filter((miniTest) => miniTest.score !== null).length} bài đã chấm` : ""}` } : null,
        miniTestCount: miniTests.filter((miniTest) => miniTest.score !== null).length,
        latestExam: latestExam ? { ...latestExam, name: `${latestExam.name || "Kỳ thi"}${examResults.length > 1 ? ` · ${examResults.length} kỳ thi` : ""}` } : null,
        examResults, examCount: examResults.length,
        warningLevel: getQualityWarningLevel({ attendanceRate, assignmentRate, latestMiniTestRate: miniTestRate, latestExamFailed: isExamFailed(latestExam) }, thresholds),
        updatedAt: quality?.updatedAt || quality?.createdAt || null,
      };
    });
    return { rows, resolvedOwnerId };
  }

  static async list(ownerId: OwnerScope, filters: QualityFilters, branchId?: string) {
    const { rows } = await this.resolveRows(ownerId, filters, branchId);
    const filteredRows = filters.warningLevel ? rows.filter((row) => row.warningLevel === filters.warningLevel) : rows;
    filteredRows.sort((left, right) => left.studentName.localeCompare(right.studentName, "vi"));
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 25)));
    const average = (values: number[]) => values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
    return {
      items: filteredRows.slice((page - 1) * limit, page * limit),
      summary: {
        totalStudents: filteredRows.length, riskCount: filteredRows.filter((row) => row.warningLevel === "risk").length, watchCount: filteredRows.filter((row) => row.warningLevel === "watch").length,
        averageAttendanceRate: average(filteredRows.map((row) => row.attendance.rate).filter((rate): rate is number => rate !== null)),
        averageAssignmentRate: average(filteredRows.map((row) => row.assignments.rate).filter((rate): rate is number => rate !== null)),
      }, page, limit, total: filteredRows.length, totalPages: Math.ceil(filteredRows.length / limit),
    };
  }

  static async detail(ownerId: OwnerScope, batchId: string, studentId: string, branchId?: string) {
    const result = await this.list(ownerId, { batchId, limit: 100 }, branchId);
    const item = result.items.find((row) => row.studentId === studentId);
    if (!item) throw new Error("Không tìm thấy dữ liệu chất lượng của học viên trong lớp này.");
    return { ...item, miniTests: await this.getStudentMiniTests(ownerId, batchId, studentId, branchId) };
  }

  private static async getStudentMiniTests(ownerId: OwnerScope, batchId: string, studentId: string, branchId?: string) {
    const miniTests = await BatchMiniTest.find({ ...ownerQuery(ownerId), ...branchQuery(branchId), batchId }).lean();
    return miniTests.map((miniTest) => {
      const result = miniTest.results.find((entry) => entry.studentId === studentId);
      const score = result?.score ?? null;
      return { id: String(miniTest._id), title: miniTest.title, date: miniTest.date, maxScore: miniTest.maxScore, score, note: result?.note || "", assessedBy: result?.assessedBy || "", assessedAt: result?.assessedAt || null, rate: score === null ? null : toRate(score, miniTest.maxScore) };
    }).sort((left, right) => parseDateValue(right.date) - parseDateValue(left.date));
  }

  private static async assertContext(ownerId: OwnerScope, batchId: string, studentId: string, branchId?: string) {
    const batch = await Batch.findOne({ _id: batchId, ...ownerQuery(ownerId), ...branchQuery(branchId) });
    if (!batch) throw new Error("Không tìm thấy lớp học.");
    const student = await Student.findOne({ _id: studentId, ...ownerQuery(ownerId), ...branchQuery(branchId) });
    if (!student) throw new Error("Không tìm thấy học viên.");
    const enrollment = await BatchEnrollment.exists({ ownerId: batch.ownerId, branchId: batch.branchId, batchId, studentId });
    if (!enrollment && !batch.learnerIds.includes(studentId)) throw new Error("Học viên không thuộc lớp này.");
    return { batch, student };
  }

  private static async ensureRecord(ownerId: OwnerScope, batchId: string, studentId: string, actor: QualityActor) {
    const { batch } = await this.assertContext(ownerId, batchId, studentId, actor.branchId);
    return StudentQualityRecord.findOneAndUpdate(
      { ownerId: batch.ownerId, branchId: batch.branchId, batchId, studentId },
      { $setOnInsert: { ownerId: batch.ownerId, branchId: batch.branchId, batchId, studentId }, $set: { updatedBy: actor.uid } },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
    );
  }

  static async updateAssessment(ownerId: OwnerScope, batchId: string, studentId: string, data: { attitudeNote?: string; teacherAssessment?: string }, actor: QualityActor) {
    const record = await this.ensureRecord(ownerId, batchId, studentId, actor);
    if (data.attitudeNote !== undefined) record.attitudeNote = data.attitudeNote;
    if (data.teacherAssessment !== undefined) record.teacherAssessment = data.teacherAssessment;
    record.updatedBy = actor.uid;
    await record.save();
    return this.detail(ownerId, batchId, studentId, actor.branchId);
  }

  static async createMiniTest(ownerId: OwnerScope, batchId: string, studentId: string, data: { title: string; date: string; score: number; maxScore: number; note?: string }, actor: QualityActor) {
    const { batch } = await this.assertContext(ownerId, batchId, studentId, actor.branchId);
    await BatchMiniTest.create({ ownerId: batch.ownerId, branchId: batch.branchId, batchId, title: data.title, date: data.date, maxScore: data.maxScore, createdBy: actor.uid, results: [{ studentId, score: data.score, note: data.note || "", assessedBy: actor.uid, assessedAt: new Date() }] });
    return this.detail(ownerId, batchId, studentId, actor.branchId);
  }

  static async updateMiniTest(ownerId: OwnerScope, batchId: string, studentId: string, miniTestId: string, data: Partial<{ title: string; date: string; score: number; maxScore: number; note: string }>, actor: QualityActor) {
    const { batch } = await this.assertContext(ownerId, batchId, studentId, actor.branchId);
    const miniTest = await BatchMiniTest.findOne({ _id: miniTestId, ownerId: batch.ownerId, branchId: batch.branchId, batchId });
    if (!miniTest) throw new Error("Không tìm thấy bài mini test.");
    if (data.title !== undefined) miniTest.title = data.title;
    if (data.date !== undefined) miniTest.date = data.date;
    if (data.maxScore !== undefined) miniTest.maxScore = data.maxScore;
    const result = miniTest.results.find((entry) => entry.studentId === studentId);
    if (!result) miniTest.results.push({ studentId, score: data.score, note: data.note || "", assessedBy: actor.uid, assessedAt: new Date() });
    else {
      if (data.score !== undefined) result.score = data.score;
      if (data.note !== undefined) result.note = data.note;
      result.assessedBy = actor.uid; result.assessedAt = new Date();
    }
    if (miniTest.results.some((entry) => entry.score !== undefined && entry.score > miniTest.maxScore)) throw new Error("Điểm không được lớn hơn thang điểm.");
    await miniTest.save();
    return this.detail(ownerId, batchId, studentId, actor.branchId);
  }

  static async deleteMiniTest(ownerId: OwnerScope, batchId: string, studentId: string, miniTestId: string, actor: QualityActor) {
    const { batch } = await this.assertContext(ownerId, batchId, studentId, actor.branchId);
    const miniTest = await BatchMiniTest.findOne({ _id: miniTestId, ownerId: batch.ownerId, branchId: batch.branchId, batchId });
    if (!miniTest) throw new Error("Không tìm thấy bài mini test.");
    const before = miniTest.results.length;
    miniTest.results = miniTest.results.filter((entry) => entry.studentId !== studentId);
    if (miniTest.results.length === before) throw new Error("Không tìm thấy điểm mini test của học viên.");
    await miniTest.save();
    return this.detail(ownerId, batchId, studentId, actor.branchId);
  }

  static async gradeAssignment(ownerId: OwnerScope, batchId: string, studentId: string, assignmentId: string, data: { score: number; feedback?: string }, actor: QualityActor) {
    const { batch } = await this.assertContext(ownerId, batchId, studentId, actor.branchId);
    const assignment = await AssignmentModel.findOne({ _id: assignmentId, ownerId: batch.ownerId, branchId: batch.branchId, batchId });
    if (!assignment) throw new Error("Không tìm thấy bài tập của lớp.");
    const submission = await SubmissionModel.findOne({ assignmentId, studentId });
    if (!submission) throw new Error("Học viên chưa nộp bài tập này.");
    if (data.score > (assignment.maxScore || DEFAULT_QUALITY_THRESHOLDS.assignmentMaxScore)) throw new Error("Điểm không được lớn hơn thang điểm của bài tập.");
    submission.score = data.score; submission.feedback = data.feedback || ""; submission.status = "graded"; submission.gradedAt = new Date();
    await submission.save();
    return this.detail(ownerId, batchId, studentId, actor.branchId);
  }
}
