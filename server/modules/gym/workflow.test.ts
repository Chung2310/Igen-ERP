import { beforeAll, afterAll, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { UserModel } from "../../model/user.model";
import { assertGymRole, type GymActor } from "./access";
import {
  records,
  saveRecord,
  getRecord,
  listRecords,
  removeRecord,
} from "./store";
import { assignPlan, createTrainer, deleteTrainer, generateProgressReport, publishGoal, publishKnowledge, publishMeasurement, publishNutritionPlan, publishProgressReport, publishWorkoutPlan, trainerPage, trainers, transfer, updateTrainer } from "./operations";
import { validateInput } from "./validation";
import express from "express";
import { gymRouter } from "./router";
import { createMuscleGroup, deleteMuscleGroup, listMuscleGroups } from "./muscle-groups";
import { searchKnowledge } from "./knowledge-index";
import { requireModule } from "../../middleware/require-module";
import { CompanyModel } from "../../model/company.model";
import { BranchModel } from "../../model/branch.model";
import { RolePermissionModel } from "../../model/role-permission.model";

let mongo: MongoMemoryReplSet;
const branchId = new mongoose.Types.ObjectId().toString();
const actor = (role: string): GymActor => ({
  userId: new mongoose.Types.ObjectId().toString(),
  role,
  companyCode: "GYM_TEST",
  branchId,
});
const pt = actor("pt"),
  otherPt = actor("pt"),
  admin = actor("admin");
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  await UserModel.collection.insertMany(
    [pt, otherPt, admin].map((a) => ({
      _id: new mongoose.Types.ObjectId(a.userId),
      email: `${a.userId}@example.invalid`,
      role: a.role,
      companyCode: a.companyCode,
      branchId,
      displayName: a.role,
      isActive: true,
    })),
  );
  // Create the approved collections before transactions; no application database is used.
  for (const entity of [
    "customers",
    "workout-templates",
    "workout-plans",
    "exercises",
    "nutrition-plans",
    "sessions",
    "measurements",
    "goals",
    "progress-reports",
    "packages",
    "package-templates",
    "transfers",
    "knowledge",
  ] as const)
    await records(entity).insertOne({
      _id: "setup",
      revision: 1,
      createdAt: "",
      updatedAt: "",
    });
  await mongoose.connection.db!.createCollection("gym_knowledge_chunks");
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
it("manages branch muscle groups and protects groups used by exercises", async () => {
  const created = await createMuscleGroup(pt, "Cẳng tay");
  expect((await listMuscleGroups(pt)).find(group => group._id === created._id)?.exerciseCount).toBe(0);
  await expect(createMuscleGroup(pt, " cẳng  tay ")).rejects.toThrow("đã tồn tại");
  const otherBranch = { ...pt, branchId: new mongoose.Types.ObjectId().toString() };
  expect((await listMuscleGroups(otherBranch)).some(group => group._id === created._id)).toBe(false);
  await saveRecord(pt, "exercises", { name: "Reverse curl", muscleGroup: "Cẳng tay", trackingType: "STRENGTH" });
  expect((await listMuscleGroups(pt)).find(group => group._id === created._id)?.exerciseCount).toBe(1);
  await expect(deleteMuscleGroup(pt, created._id)).rejects.toThrow("đang có bài tập");
  const empty = await createMuscleGroup(pt, "Cơ cổ");
  await deleteMuscleGroup(pt, empty._id);
  expect((await listMuscleGroups(pt)).some(group => group._id === empty._id)).toBe(false);
});
it("creates a customer without an ERP login and scopes records to the assigned PT", async () => {
  const before = await UserModel.countDocuments();
  const customer = await saveRecord(pt, "customers", {
    fullName: "Nguyễn An",
    phone: "0912345678",
  });
  expect(await UserModel.countDocuments()).toBe(before);
  expect(customer.assignedPtId).toBe(pt.userId);
  await expect(getRecord(otherPt, "customers", customer._id)).rejects.toThrow();
  await expect(
    getRecord({ ...admin, companyCode: "OTHER" }, "customers", customer._id),
  ).rejects.toThrow();
  expect((await getRecord(admin, "customers", customer._id)).fullName).toBe(
    "Nguyễn An",
  );
  expect(() => assertGymRole("gym_customer")).toThrow();
});
it("saves AI workout exercises to the library and links them to the template in one transaction", async () => {
  const name = "Cable Face Pull AI";
  const draftId = new mongoose.Types.ObjectId().toString();
  const template = await saveRecord(pt, "workout-templates", {
    title: "Vai và lưng", goal: "Tăng sức mạnh", level: "BEGINNER",
    durationWeeks: 1, durationDays: 7,
    generatedExercises: [{ draftId, name, muscleGroup: "Vai", level: "BEGINNER", trackingType: "STRENGTH", technique: "Kéo dây về ngang mặt" }],
    scheduledExercises: [{ exerciseId: draftId, name, trackingType: "STRENGTH", prescription: { sets: 3, reps: "12" }, weekNumber: 1, dayNumber: 1, startMinute: 0, durationMinutes: 60 }],
    schedule: [{ day: 1, title: "Ngày 1", exercises: [{ exerciseId: draftId, name, trackingType: "STRENGTH", sets: 3, reps: "12" }] }],
  });
  const exercise = await records("exercises").findOne({ name });
  expect(exercise?._id).toBeTruthy();
  expect(template.scheduledExercises?.[0]?.exerciseId).toBe(exercise?._id);
  expect(template.schedule?.[0]?.exercises?.[0]?.exerciseId).toBe(exercise?._id);
  expect(template.generatedExercises).toBeUndefined();
});
it("keeps InBody drafts private until published and supports withdrawal", async () => {
  const customer = await saveRecord(pt, "customers", { fullName: "Nguyễn Minh", phone: "0911222333" });
  const draft = await saveRecord(pt, "measurements", { customerId: customer._id, measurementDate: "2026-11-22", weight: 70 });
  expect(draft.status).toBe("DRAFT");
  const legacyId = new mongoose.Types.ObjectId().toString();
  await records("measurements").insertOne({ _id: legacyId, customerId: customer._id, measurementDate: "2026-11-20", weight: 71, revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), companyCode: pt.companyCode, branchId: pt.branchId });
  expect((await listRecords(pt, "measurements", { customerId: customer._id, status: "DRAFT" })).data.some(row => row._id === legacyId)).toBe(true);
  const published = await publishMeasurement(pt, draft._id, draft.revision, true);
  expect(published.status).toBe("PUBLISHED");
  expect(published.publishedAt).toBeTruthy();
  expect((await listRecords(pt, "measurements", { customerId: customer._id, status: "PUBLISHED" })).data.some(row => row._id === draft._id)).toBe(true);
  expect((await listRecords(pt, "measurements", { customerId: customer._id, status: "DRAFT" })).data.some(row => row._id === draft._id)).toBe(false);
  await expect(publishMeasurement(pt, draft._id, draft.revision, false)).rejects.toThrow("đã thay đổi");
  const withdrawn = await publishMeasurement(pt, draft._id, published.revision, false);
  expect(withdrawn.status).toBe("DRAFT");
  expect(withdrawn.publishedAt).toBeNull();
  expect((await listRecords(pt, "measurements", { customerId: customer._id, status: "DRAFT" })).data.some(row => row._id === draft._id)).toBe(true);
});
it("indexes knowledge chunks and searches only published documents within the branch", async () => {
  const doc = await saveRecord(admin, "knowledge", { title: "Kỹ thuật squat", topic: "WORKOUT", content: "Squat giữ lưng trung lập và đầu gối theo hướng mũi chân. Tập có kiểm soát để bảo vệ khớp gối." });
  expect(doc.ragChunkCount).toBeGreaterThan(0);
  expect(await searchKnowledge(admin, "kỹ thuật squat")).toHaveLength(0);
  const published = await publishKnowledge(admin, doc._id, doc.revision, true);
  expect((await searchKnowledge(admin, "squat lưng trung lập"))[0]?.documentId).toBe(doc._id);
  expect(await searchKnowledge({ ...admin, branchId: new mongoose.Types.ObjectId().toString() }, "squat lưng trung lập")).toHaveLength(0);
  const edited = await saveRecord(admin, "knowledge", { title: doc.title, topic: doc.topic, content: "Deadlift cần giữ cột sống trung lập và thanh tạ gần thân.", revision: published.revision }, published._id);
  expect((await searchKnowledge(admin, "deadlift cột sống"))[0]?.documentId).toBe(doc._id);
  await removeRecord(admin, "knowledge", edited._id, edited.revision);
  expect(await searchKnowledge(admin, "deadlift cột sống")).toHaveLength(0);
});
it("creates, edits and removes a complete PT profile", async () => {
  const created = await createTrainer(admin, { displayName: "PT Minh", email: "pt.minh@example.invalid", password: "123456", phone: "0901001001", status: "ACTIVE", gender: "MALE", dateOfBirth: "1995-04-12", specialization: "Sức mạnh", yearsOfExperience: 5, certificates: ["NASM CPT"], bio: "Huấn luyện cá nhân" });
  expect(created.specialization).toBe("Sức mạnh");
  const updated = await updateTrainer(admin, created._id, { ...created, displayName: "PT Minh Anh", specialization: "Tăng cơ", status: "LOCKED", revision: created.revision });
  expect(updated?.specialization).toBe("Tăng cơ");
  expect(updated?.status).toBe("LOCKED");
  expect((await trainers(admin)).some(item => item._id === created._id)).toBe(true);
  expect((await trainerPage(admin, { search: "minh anh", status: "LOCKED", page: 1, limit: 1 })).data.map(item => item._id)).toEqual([created._id]);
  expect((await trainerPage(admin, { search: "minh anh", status: "ACTIVE" })).meta.total).toBe(0);
  await expect(updateTrainer(admin, created._id, { ...created, revision: created.revision })).rejects.toThrow("đã thay đổi");
  await deleteTrainer(admin, created._id);
  expect((await trainers(admin)).some(item => item._id === created._id)).toBe(false);
});
it("keeps package templates separate from customer packages and exposes only active templates to PT", async () => {
  const active = await saveRecord(admin, "package-templates", {
    name: "Gói PT 24 buổi", totalSessions: 24, durationDays: 60,
    price: 3_600_000, status: "ACTIVE", description: "Tập cùng PT",
  });
  const inactive = await saveRecord(admin, "package-templates", {
    name: "Gói ngừng áp dụng", totalSessions: 12, durationDays: 30,
    price: 1_800_000, status: "INACTIVE",
  });
  const visible = await listRecords(pt, "package-templates", {});
  expect(visible.data.some(item => item._id === active._id)).toBe(true);
  expect(visible.data.some(item => item._id === inactive._id)).toBe(false);
  await expect(saveRecord(pt, "package-templates", {
    name: "Không được tạo", totalSessions: 12, durationDays: 30,
  })).rejects.toThrow();
  const customer = await saveRecord(pt, "customers", { fullName: "Học viên gói PT", phone: "0912345780" });
  const assigned = await saveRecord(pt, "packages", {
    customerId: customer._id, name: active.name, totalSessions: active.totalSessions,
    startDate: "2026-11-22", endDate: "2027-01-21", status: "ACTIVE",
  });
  expect(assigned.customerId).toBe(customer._id);
  expect((await getRecord(pt, "package-templates", active._id)).price).toBe(3_600_000);
});
it("saves the original goal fields and publishes or withdraws a goal", async () => {
  const customer = await saveRecord(pt, "customers", { fullName: "Học viên mục tiêu", phone: "0912345781" });
  const goal = await saveRecord(pt, "goals", { customerId: customer._id, title: "Giảm mỡ", type: "FAT_LOSS", targetValue: 5, targetUnit: "kg", deadline: "2027-03-01", sessionsPerWeek: 3, cardioNotes: "Chạy 20 phút", evaluationNotes: "Theo dõi mỗi tháng" });
  expect(goal.status).toBe("DRAFT");
  const published = await publishGoal(pt, goal._id, goal.revision, true);
  expect(published.status).toBe("PUBLISHED");
  expect(published.publishedAt).toBeTruthy();
  const withdrawn = await publishGoal(pt, goal._id, published.revision, false);
  expect(withdrawn.status).toBe("DRAFT");
});
it("persists a Studio template with scheduled and unscheduled exercises and can assign it", async () => {
  const exercise = await saveRecord(pt, "exercises", { name: "Barbell Back Squat", muscleGroup: "Legs", trackingType: "STRENGTH" });
  const customer = await saveRecord(pt, "customers", { fullName: "Học viên Studio", phone: "0912345791" });
  const item = { exerciseId: exercise._id, name: exercise.name, muscleGroup: "Legs", trackingType: "STRENGTH", prescription: { sets: 3, reps: "8", targetWeight: 40 }, durationMinutes: 60 };
  const template = await saveRecord(pt, "workout-templates", {
    title: "Giáo án 7 ngày", goal: "Tăng sức mạnh", level: "BEGINNER", durationWeeks: 1, durationDays: 7,
    scheduledExercises: [{ ...item, weekNumber: 1, dayNumber: 1, startMinute: 480 }],
    unscheduledExercises: [{ ...item, name: "Squat chưa xếp" }],
    schedule: [{ day: 1, title: "Tuần 1 · Ngày 1", exercises: [{ exerciseId: exercise._id, name: exercise.name, trackingType: "STRENGTH", prescription: item.prescription, sets: 3, reps: "8", weight: 40 }] }],
    status: "ACTIVE",
  });
  expect(template.scheduledExercises[0].startMinute).toBe(480);
  expect(template.unscheduledExercises[0].name).toBe("Squat chưa xếp");
  const assigned = await assignPlan(pt, customer._id, template._id);
  expect(assigned.schedule[0].exercises[0].name).toBe(exercise.name);
  const edited = await saveRecord(pt, "workout-plans", {
    customerId: customer._id, title: assigned.title, goal: assigned.goal, level: assigned.level,
    durationWeeks: 1, durationDays: 7, scheduledExercises: assigned.scheduledExercises,
    unscheduledExercises: assigned.unscheduledExercises, schedule: assigned.schedule,
    status: "ACTIVE", revision: assigned.revision,
  }, assigned._id);
  expect(edited.version).toBe(2);
  expect(edited.scheduledExercises[0].dayNumber).toBe(1);
});
it("stores the original roadmap phase, week, strategy and checkpoint structure", async () => {
  const customer = await saveRecord(pt, "customers", { fullName: "Học viên lộ trình", phone: "0912345792" });
  const roadmap = await saveRecord(pt, "roadmaps", {
    customerId: customer._id, title: "Lộ trình 4 tuần", status: "DRAFT",
    baseline: { weight: 72 },
    strategy: { estimatedWeeks: 4, sessionsPerWeek: 3, trainingMethod: "Kháng lực", cardioProtocol: "Zone 2", nutrition: { targetCalories: 2200 }, checkpoints: [{ week: 4, title: "Đánh giá InBody", description: "So sánh chỉ số" }] },
    phases: [{ order: 1, name: "Thích nghi", durationWeeks: 4, goals: ["Ổn định kỹ thuật"], weeks: [{ week: 1, focus: "Nền tảng", sessionTargets: 3, sessions: [] }] }],
  });
  expect(roadmap.phases[0].name).toBe("Thích nghi");
  expect(roadmap.phases[0].weeks[0].focus).toBe("Nền tảng");
  expect(roadmap.strategy.checkpoints[0].week).toBe(4);
});
it("keeps the seven-day nutrition menu and publishes the saved plan", async () => {
  const customer = await saveRecord(pt, "customers", { fullName: "Học viên thực đơn", phone: "0912345793" });
  const day = (number: number) => ({ dayNumber: number, date: `2026-11-${String(21 + number).padStart(2, "0")}`, dayOfWeek: "Thứ hai", meals: [{ id: `meal-${number}`, name: "Bữa sáng", timeSlot: "07:00", calories: 320, items: [{ name: "Yến mạch", amount: "100g", calories: 320, protein: 12, carbs: 60, fat: 4 }] }] });
  const days = Array.from({ length: 7 }, (_, index) => day(index + 1));
  const plan = await saveRecord(pt, "nutrition-plans", { customerId: customer._id, title: "Thực đơn 7 ngày", targetCalories: 2000, macros: { protein: 120, carbs: 230, fat: 60 }, startDate: "2026-11-22", endDate: "2026-11-28", durationDays: 7, menu: [{ weekNumber: 1, name: "Tuần 1", startDate: "2026-11-22", endDate: "2026-11-28", days }], dailyPlans: days });
  expect(plan.menu[0].days).toHaveLength(7);
  expect(plan.dailyPlans[5].meals[0].items[0].name).toBe("Yến mạch");
  const published = await publishNutritionPlan(pt, plan._id, plan.revision, true);
  expect(published.status).toBe("PUBLISHED");
});
it("creates a customer workout draft with free-text exercises, publishes it and records a session", async () => {
  const customer = await saveRecord(pt, "customers", { fullName: "Học viên giáo án", phone: "0912345782" });
  const plan = await saveRecord(pt, "workout-plans", {
    customerId: customer._id, title: "Giáo án tăng cơ", startDate: "2026-11-22", endDate: "2027-01-22",
    sessions: [{ name: "Ngực và tay sau", exercises: [{ name: "Bench Press", trackingType: "STRENGTH", prescription: { sets: 3, reps: "8-12", targetWeight: 40, restSeconds: 90 } }] }],
  });
  expect(plan.publicationStatus).toBe("DRAFT");
  expect(plan.schedule[0].exercises[0].name).toBe("Bench Press");
  const published = await publishWorkoutPlan(pt, plan._id, plan.revision, true);
  expect(published.publicationStatus).toBe("PUBLISHED");
  const workout = await saveRecord(pt, "sessions", {
    customerId: customer._id, planId: plan._id, sessionIndex: 0,
    performedAt: "2026-11-22T09:00:00+07:00", attendance: "PRESENT",
    exerciseLogs: [{ name: "Bench Press", trackingType: "STRENGTH", result: { sets: [{ reps: 10, weight: 40, completed: true }] } }],
  });
  expect(workout.exerciseLogs[0].name).toBe("Bench Press");
  const changed = await saveRecord(pt, "workout-plans", {
    customerId: customer._id, title: "Giáo án tăng cơ sửa", startDate: "2026-11-22", endDate: "2027-01-22",
    sessions: plan.sessions, revision: published.revision,
  }, plan._id);
  expect(changed.publicationStatus).toBe("DRAFT");
  expect(changed.version).toBe(2);
});
it("generates, edits and publishes a progress report from saved sessions and measurements", async () => {
  const customer = await saveRecord(pt, "customers", { fullName: "Học viên báo cáo", phone: "0912345783" });
  const plan = await saveRecord(pt, "workout-plans", { customerId: customer._id, title: "Giáo án báo cáo", sessions: [] });
  await saveRecord(pt, "sessions", { customerId: customer._id, planId: plan._id, performedAt: "2026-11-22T09:00:00+07:00", attendance: "PRESENT" });
  await saveRecord(pt, "measurements", { customerId: customer._id, measurementDate: "2026-11-01", weight: 70 });
  await saveRecord(pt, "measurements", { customerId: customer._id, measurementDate: "2026-11-22", weight: 68 });
  const report = await generateProgressReport(pt, { customerId: customer._id, periodStart: "2026-11-01", periodEnd: "2026-11-30" });
  expect(report.status).toBe("DRAFT");
  expect(report.summary).toContain("1/1 buổi");
  expect(report.metrics.weightDelta).toBe(-2);
  const edited = await saveRecord(pt, "progress-reports", { customerId: customer._id, periodStart: report.periodStart, periodEnd: report.periodEnd, summary: `${report.summary} Đã xem lại.`, revision: report.revision }, report._id);
  expect(edited.version).toBe(2);
  const published = await publishProgressReport(pt, report._id, edited.revision, true);
  expect(published.status).toBe("PUBLISHED");
  await expect(removeRecord(pt, "progress-reports", report._id, published.revision)).rejects.toThrow();
});
it("assigns a snapshot, records a session and preserves history when transferring the customer", async () => {
  const customer = await saveRecord(pt, "customers", {
    fullName: "Lê Bình",
    phone: "0912345679",
  });
  const template = await saveRecord(pt, "workout-templates", {
    title: "Giáo án 4 tuần",
    durationWeeks: 4,
    schedule: [],
    status: "ACTIVE",
  });
  const plan = await assignPlan(pt, customer._id, template._id);
  await saveRecord(
    pt,
    "workout-templates",
    { title: "Mẫu đã sửa", durationWeeks: 4, revision: template.revision },
    template._id,
  );
  expect((await getRecord(pt, "workout-plans", plan._id)).title).toBe(
    "Giáo án 4 tuần",
  );
  const session = await saveRecord(pt, "sessions", {
    customerId: customer._id,
    planId: plan._id,
    performedAt: "2026-11-22T09:00:00+07:00",
    attendance: "PRESENT",
  });
  await expect(
    transfer(pt, {
      customerId: customer._id,
      toPtId: otherPt.userId,
      reason: "Chuyển lịch",
      revision: customer.revision,
    }),
  ).rejects.toThrow();
  await transfer(admin, {
    customerId: customer._id,
    toPtId: otherPt.userId,
    reason: "Chuyển lịch",
    revision: customer.revision,
  });
  const history = await listRecords(admin, "transfers", { status: "ADMIN_FORCED", page: 1, limit: 1 });
  expect(history.data).toHaveLength(1);
  expect(history.meta.total).toBeGreaterThanOrEqual(1);
  await expect(getRecord(pt, "sessions", session._id)).rejects.toThrow();
  expect((await getRecord(otherPt, "sessions", session._id)).planId).toBe(
    plan._id,
  );
  await expect(
    transfer(admin, {
      customerId: customer._id,
      toPtId: pt.userId,
      reason: "Cũ",
      revision: customer.revision,
    }),
  ).rejects.toThrow();
});
it("archives the previous plan and saves the complete session once", async () => {
  const customer = await saveRecord(pt, "customers", { fullName: "Mai An", phone: "0912345688" });
  const exercise = await saveRecord(pt, "exercises", { name: "Squat", muscleGroup: "Chân", trackingType: "STRENGTH" });
  const template = await saveRecord(pt, "workout-templates", {
    title: "Sức mạnh", durationWeeks: 4, status: "ACTIVE",
    schedule: [{ day: 1, title: "Ngày 1", exercises: [{ exerciseId: exercise._id, name: "Squat", sets: 1, reps: "10" }] }],
  });
  const previous = await assignPlan(pt, customer._id, template._id);
  const plan = await assignPlan(pt, customer._id, template._id);
  expect((await getRecord(pt, "workout-plans", previous._id)).status).toBe("ARCHIVED");
  await saveRecord(pt, "packages", { customerId: customer._id, name: "PT 2 buổi", totalSessions: 2, startDate: "2026-11-01", endDate: "2026-12-01" });
  const payload = {
    customerId: customer._id, planId: plan._id, planRevision: plan.revision, sessionIndex: 0,
    idempotencyKey: "full-session-mai-an", performedAt: "2026-11-22T09:00:00+07:00", attendance: "PRESENT",
    exerciseLogs: [{ exerciseId: exercise._id, name: "Squat", trackingType: "STRENGTH", result: { sets: [{ reps: 10, weight: 20, completed: true }] } }],
    bodyMeasurement: { weight: 70, bodyFatPercentage: 21 },
    progressPhotos: [{ photoUrl: "https://example.com/progress.webp", angle: "FRONT" }],
    customerSignature: { signatureUrl: "data:image/png;base64,YQ==", signerName: "Mai An" },
  };
  const saved = await saveRecord(pt, "sessions", payload);
  expect(saved.customerSignature.signerName).toBe("Mai An");
  expect(saved.exerciseLogs[0].result.sets[0].weight).toBe(20);
  expect((await records("measurements").findOne({ sessionId: saved._id }))?.weight).toBe(70);
  expect((await records("progress-photos").findOne({ sessionId: saved._id }))?.stage).toBe("PROGRESS");
  expect((await records("packages").findOne({ customerId: customer._id }))?.usedSessions).toBe(1);
  expect((await records("packages").findOne({ customerId: customer._id }))?.remainingSessions).toBe(1);
  expect((await saveRecord(pt, "sessions", payload))._id).toBe(saved._id);
  expect((await records("packages").findOne({ customerId: customer._id }))?.usedSessions).toBe(1);
  expect(await records("progress-photos").countDocuments({ sessionId: saved._id })).toBe(1);
});
it("stores and manages independent Before and After progress photos", async () => {
  const customer = await saveRecord(pt, "customers", { fullName: "Ảnh tiến độ", phone: "0912345699" });
  const before = await saveRecord(pt, "progress-photos", { customerId: customer._id, photoUrl: "https://example.com/before.webp", takenDate: "2026-11-01", stage: "BEFORE", angle: "FRONT", weight: 72 });
  expect(before.stage).toBe("BEFORE");
  expect((await listRecords(pt, "progress-photos", { customerId: customer._id })).meta.total).toBe(1);
  const after = await saveRecord(pt, "progress-photos", { customerId: customer._id, photoUrl: before.photoUrl, takenDate: "2026-11-22", stage: "AFTER", angle: "SIDE", weight: 69, revision: before.revision }, before._id);
  expect(after.stage).toBe("AFTER");
  await removeRecord(pt, "progress-photos", after._id, after.revision);
  expect((await listRecords(pt, "progress-photos", { customerId: customer._id })).meta.total).toBe(0);
});
it("rejects foreign customer references, tenant injection and stale revisions", async () => {
  const customer = await saveRecord(pt, "customers", {
    fullName: "Mai",
    phone: "0912345680",
  });
  await expect(
    saveRecord(otherPt, "nutrition-plans", {
      customerId: customer._id,
      title: "Thực đơn",
      targetCalories: 1800,
      macros: { protein: 120, carbs: 200, fat: 60 },
      startDate: "2026-11-22",
      endDate: "2026-11-28",
    }),
  ).rejects.toThrow();
  expect(() =>
    validateInput("customers", {
      fullName: "A",
      phone: "0912345678",
      companyCode: "OTHER",
    }),
  ).toThrow();
  await expect(
    saveRecord(
      pt,
      "customers",
      { fullName: "Mai sửa", phone: "0912345680", revision: 999 },
      customer._id,
    ),
  ).rejects.toThrow();
});
it("exposes only published knowledge to PT and keeps administration restricted", async () => {
  const doc = await saveRecord(admin, "knowledge", {
    title: "Quy chuẩn",
    topic: "Dinh dưỡng",
    content: "Nội dung chuyên môn",
  });
  expect(
    (await listRecords(pt, "knowledge", { status: "DRAFT" })).meta.total,
  ).toBe(0);
  await expect(getRecord(pt, "knowledge", doc._id)).rejects.toThrow();
  const published = await publishKnowledge(admin, doc._id, doc.revision, true);
  expect((await getRecord(pt, "knowledge", doc._id)).content).toBe(
    "Nội dung chuyên môn",
  );
  await expect(
    removeRecord(pt, "knowledge", doc._id, published.revision),
  ).rejects.toThrow();
  await publishKnowledge(admin, doc._id, published.revision, false);
  await expect(getRecord(pt, "knowledge", doc._id)).rejects.toThrow();
});

it("enforces role, branch and tenant activation through HTTP, including an older admin role record", async () => {
  await CompanyModel.collection.insertOne({
    code: pt.companyCode,
    name: "Gym",
    enabledModules: ["gym"],
  });
  await BranchModel.collection.insertOne({
    _id: new mongoose.Types.ObjectId(branchId),
    companyCode: pt.companyCode,
    name: "Main",
    code: "MAIN",
    isActive: true,
  });
  await RolePermissionModel.collection.insertOne({
    companyCode: pt.companyCode,
    role: "admin",
    permissions: ["access:manage"],
    level: 1,
  });
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const chosen = req.get("x-test-role") === "admin" ? admin : pt;
    req.user = {
      id: chosen.userId,
      role: chosen.role,
      companyCode: chosen.companyCode,
      branchId,
    };
    next();
  });
  app.use("/gym", requireModule("gym"), gymRouter);
  app.use((error: any, _req: any, res: any, _next: any) =>
    res.status(error.status || 500).json({ message: error.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${(server.address() as any).port}/gym`;
  try {
    expect((await fetch(`${origin}/customers`)).status).toBe(200);
    expect((await fetch(`${origin}/trainers`)).status).toBe(403);
    expect(
      (
        await fetch(`${origin}/trainers`, {
          headers: { "x-test-role": "admin" },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(`${origin}/customers`, {
          headers: { "x-branch-id": new mongoose.Types.ObjectId().toString() },
        })
      ).status,
    ).toBe(403);
    const response = await fetch(`${origin}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "HTTP khách", phone: "0912345699" }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).assignedPtId).toBe(pt.userId);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
