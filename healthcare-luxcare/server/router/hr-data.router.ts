import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { HRCalendarEventModel } from "../model/hr-calendar-event.model";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { WorkflowModel } from "../model/workflow.model";
import { TrainingCourseModel } from "../model/training-course.model";
import { TrainingEnrollmentModel } from "../model/training-enrollment.model";
import { validateWorkflowDefinition } from "../service/workflow-definition.service";
import { getTimekeepingAdjustmentHistory, TimekeepingAdjustmentError, updateTimekeepingWithAudit } from "../service/timekeeping-adjustment.service";
import { sourceUploadFinalizer } from "../service/source-upload-finalizer.service";

const router = Router();
router.use(requireAuth as any);

function companyCode(req: any, query?: unknown): string {
  if (req.user?.role === "trial_user") return String(req.user.companyCode || "").trim();
  return String(query || req.user?.companyCode || "").trim();
}
function ownerFilter(req: any, query?: unknown) {
  const code = companyCode(req, query);
  if (!code) throw new Error("Mã công ty là bắt buộc.");
  return { companyCode: code, ...(req.user?.branchId ? { branchId: req.user.branchId } : {}) };
}

function workflowUploadReferences(steps: any[] = [], existingSteps: any[] = []) {
  const existingTokens = new Set(existingSteps.flatMap((step) => (step.attachments || []).map((item: any) => item.uploadToken)).filter(Boolean));
  return steps.flatMap((step, stepIndex) => (step.attachments || []).map((item: any, attachmentIndex: number) => ({
    uploadToken: existingTokens.has(item.uploadToken) ? undefined : item.uploadToken,
    sourceField: `steps.${stepIndex}.attachments.${attachmentIndex}`,
  })));
}

async function finalizeWorkflowAttachments(req: any, workflow: any, existingSteps: any[] = []) {
  await sourceUploadFinalizer.finalize({
    companyCode: workflow.companyCode,
    branchId: workflow.branchId || req.user?.branchId,
    actorId: req.user?.id || "",
    actorName: req.user?.email,
  }, {
    expectedSourceType: "hr.kanban",
    entityType: "workflow",
    entityId: String(workflow._id),
    entityLabel: workflow.name,
    sourceRecordId: String(workflow._id),
    uploads: workflowUploadReferences(workflow.steps || [], existingSteps),
  });
}

router.post("/workflows", (req: any, _res, next) => {
  try {
    validateWorkflowDefinition(req.body);
    next();
  } catch (error) {
    next(error);
  }
});
router.patch("/workflows/:id", async (req: any, _res, next) => {
  try {
    const current = await WorkflowModel.findOne({ _id: req.params.id, ...ownerFilter(req) }).lean();
    validateWorkflowDefinition({ steps: req.body.steps ?? current?.steps, edges: req.body.edges ?? current?.edges });
    req.workflowCurrent = current;
    next();
  } catch (error) {
    next(error);
  }
});

router.get("/workflows", async (req: any, res, next) => {
  try { res.json({ success: true, data: await WorkflowModel.find(ownerFilter(req)).sort({ createdAt: -1 }).lean() }); } catch (e) { next(e); }
});
router.post("/workflows", async (req: any, res, next) => {
  try { const doc = await WorkflowModel.create({ ...req.body, ...ownerFilter(req), creatorUid: req.user.id }); await finalizeWorkflowAttachments(req, doc); res.status(201).json({ success: true, data: doc }); } catch (e) { next(e); }
});
router.patch("/workflows/:id", async (req: any, res, next) => {
  try { const doc = await WorkflowModel.findOneAndUpdate({ _id: req.params.id, ...ownerFilter(req) }, { $set: req.body }, { returnDocument: "after", runValidators: true }).lean(); if (!doc) return res.status(404).json({ success: false, message: "Không tìm thấy quy trình." }); await finalizeWorkflowAttachments(req, doc, req.workflowCurrent?.steps || []); res.json({ success: true, data: doc }); } catch (e) { next(e); }
});
router.delete("/workflows/:id", async (req: any, res, next) => {
  try { const doc = await WorkflowModel.findOneAndDelete({ _id: req.params.id, ...ownerFilter(req) }); if (!doc) return res.status(404).json({ success: false, message: "Không tìm thấy quy trình." }); res.json({ success: true, data: doc }); } catch (e) { next(e); }
});

router.get("/training-courses", async (req: any, res, next) => {
  try { res.json({ success: true, data: await TrainingCourseModel.find(ownerFilter(req, req.query.companyCode)).sort({ createdAt: -1 }).lean() }); } catch (e) { next(e); }
});
router.post("/training-courses", async (req: any, res, next) => {
  try { const doc = await TrainingCourseModel.create({ ...req.body, ...ownerFilter(req), creatorUid: req.user.id }); res.status(201).json({ success: true, data: doc }); } catch (e) { next(e); }
});
router.patch("/training-courses/:id", async (req: any, res, next) => {
  try { const doc = await TrainingCourseModel.findOneAndUpdate({ _id: req.params.id, ...ownerFilter(req) }, { $set: req.body }, { returnDocument: "after", runValidators: true }).lean(); if (!doc) return res.status(404).json({ success: false, message: "Không tìm thấy khóa đào tạo." }); res.json({ success: true, data: doc }); } catch (e) { next(e); }
});
router.delete("/training-courses/:id", async (req: any, res, next) => {
  try { const doc = await TrainingCourseModel.findOneAndDelete({ _id: req.params.id, ...ownerFilter(req) }); if (!doc) return res.status(404).json({ success: false, message: "Không tìm thấy khóa đào tạo." }); await TrainingEnrollmentModel.deleteMany({ courseId: String(doc._id), ...ownerFilter(req) }); res.json({ success: true, data: doc }); } catch (e) { next(e); }
});
router.get("/training-enrollments", async (req: any, res, next) => {
  try { const filter: any = ownerFilter(req, req.query.companyCode); if (req.user.role === "trial_user") filter.uid = req.user.id; else if (req.query.uid) filter.uid = req.query.uid; if (req.query.courseId) filter.courseId = req.query.courseId; res.json({ success: true, data: await TrainingEnrollmentModel.find(filter).sort({ createdAt: -1 }).lean() }); } catch (e) { next(e); }
});
router.post("/training-enrollments", async (req: any, res, next) => {
  try { const doc = await TrainingEnrollmentModel.create({ ...req.body, ...ownerFilter(req), uid: req.user.role === "trial_user" ? req.user.id : req.body.uid || req.user.id }); res.status(201).json({ success: true, data: doc }); } catch (e) { next(e); }
});
router.patch("/training-enrollments/:id", async (req: any, res, next) => {
  try { const filter: any = { _id: req.params.id, ...ownerFilter(req) }; if (req.user.role === "trial_user") filter.uid = req.user.id; const changes = req.user.role === "trial_user" ? Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => ["progress", "status", "startedAt", "completedAt", "completedLessons", "quizPassed", "quizScore"].includes(key))) : req.body; const doc = await TrainingEnrollmentModel.findOneAndUpdate(filter, { $set: changes }, { returnDocument: "after", runValidators: true }).lean(); if (!doc) return res.status(404).json({ success: false, message: "Không tìm thấy lượt đăng ký đào tạo." }); res.json({ success: true, data: doc }); } catch (e) { next(e); }
});
router.delete("/training-enrollments/:id", async (req: any, res, next) => {
  try { const filter: any = { _id: req.params.id, ...ownerFilter(req) }; if (req.user.role === "trial_user") filter.uid = req.user.id; const doc = await TrainingEnrollmentModel.findOneAndDelete(filter); if (!doc) return res.status(404).json({ success: false, message: "Không tìm thấy lượt đăng ký đào tạo." }); res.json({ success: true, data: doc }); } catch (e) { next(e); }
});
router.get("/hr-calendar-events", async (req: any, res, next) => {
  try { const filter: any = ownerFilter(req, req.query.companyCode); if (req.user.role === "trial_user") filter.creatorId = req.user.id; res.json({ success: true, data: await HRCalendarEventModel.find(filter).sort({ startDate: 1 }).lean() }); } catch (e) { next(e); }
});
router.post("/hr-calendar-events", async (req: any, res, next) => {
  try { const body = req.user.role === "trial_user" ? Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => ["title", "description", "startDate", "endDate"].includes(key))) : req.body; const doc = await HRCalendarEventModel.create({ ...body, ...ownerFilter(req), type: req.user.role === "trial_user" ? "event" : body.type, employeeId: req.user.role === "trial_user" ? req.user.id : body.employeeId, employeeName: req.user.role === "trial_user" ? req.user.email : body.employeeName, assigneeId: req.user.role === "trial_user" ? req.user.id : body.assigneeId, status: req.user.role === "trial_user" ? "active" : body.status, creatorId: req.user.id }); res.status(201).json({ success: true, data: doc }); } catch (e) { next(e); }
});
router.patch("/hr-calendar-events/:id", async (req: any, res, next) => {
  try { const filter: any = { _id: req.params.id, ...ownerFilter(req) }; if (req.user.role === "trial_user") filter.creatorId = req.user.id; const changes = req.user.role === "trial_user" ? Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => ["type", "title", "description", "startDate", "endDate"].includes(key))) : req.body; const doc = await HRCalendarEventModel.findOneAndUpdate(filter, { $set: changes }, { returnDocument: "after", runValidators: true }).lean(); if (!doc) return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện lịch." }); res.json({ success: true, data: doc }); } catch (e) { next(e); }
});
router.delete("/hr-calendar-events/:id", async (req: any, res, next) => {
  try { const filter: any = { _id: req.params.id, ...ownerFilter(req) }; if (req.user.role === "trial_user") filter.creatorId = req.user.id; const doc = await HRCalendarEventModel.findOneAndDelete(filter); if (!doc) return res.status(404).json({ success: false, message: "Không tìm thấy sự kiện lịch." }); res.json({ success: true, data: doc }); } catch (e) { next(e); }
});

router.get("/timekeeping-logs", async (req: any, res, next) => {
  try { const filter: any = ownerFilter(req, req.query.companyCode); if (req.query.employeeId && req.query.employeeId !== "all") filter.uid = req.query.employeeId; if (req.query.status && req.query.status !== "all") filter.status = req.query.status; if (req.query.startDate || req.query.endDate) filter.date = { ...(req.query.startDate ? { $gte: req.query.startDate } : {}), ...(req.query.endDate ? { $lte: req.query.endDate } : {}) }; const data = await TimekeepingLogModel.find(filter).sort({ date: -1 }).limit(Math.min(Number(req.query.limit) || 10000, 10000)).lean(); res.json({ success: true, data, total: data.length }); } catch (e) { next(e); }
});
router.get("/timekeeping-logs/:id/adjustments", requirePermission("timekeeping:manage") as any, async (req: any, res, next) => {
  try {
    const data = await getTimekeepingAdjustmentHistory(req.params.id, ownerFilter(req));
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof TimekeepingAdjustmentError) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
});
router.patch("/timekeeping-logs/:id", requirePermission("timekeeping:manage") as any, async (req: any, res, next) => {
  try {
    const data = await updateTimekeepingWithAudit({
      id: req.params.id,
      scope: ownerFilter(req),
      actorId: req.user.id,
      reason: req.body.adjustmentReason,
      changes: req.body,
    });
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof TimekeepingAdjustmentError) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
});

export default router;
