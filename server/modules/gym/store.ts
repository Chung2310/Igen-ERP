import mongoose, { type ClientSession } from "mongoose";
import { ObjectId, type Filter } from "mongodb";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../errors/app-error";
import { UserModel } from "../../model/user.model";
import {
  customerEntities,
  gymCollections,
  gymAdmin,
  type GymEntity,
  type GymRecord,
} from "../../../shared/gym/types";
import {
  assertGymAdmin,
  customerFilter,
  tenantFilter,
  type GymActor,
} from "./access";
import { validateInput } from "./validation";
import { indexKnowledge, removeKnowledgeIndex } from "./knowledge-index";

export function records(entity: GymEntity) {
  if (!mongoose.connection.db) throw new Error("Database chưa sẵn sàng.");
  return mongoose.connection.db.collection<GymRecord>(gymCollections[entity]);
}
export function recordId(value: unknown) {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value))
    throw new ValidationError("VALIDATION_FAILED", "Mã dữ liệu không hợp lệ.");
  return value.toLowerCase();
}
export async function queryScope(
  actor: GymActor,
  entity: GymEntity,
): Promise<Filter<GymRecord>> {
  if (entity === "customers") return customerFilter(actor);
  if (entity === "transfers") assertGymAdmin(actor);
  const scope: Filter<GymRecord> = tenantFilter(actor);
  if (customerEntities.has(entity) && !gymAdmin(actor.role)) {
    const customers = await records("customers")
      .find(customerFilter(actor), { projection: { _id: 1 } })
      .toArray();
    scope.customerId = { $in: customers.map((c) => c._id) };
  }
  if (entity === "workout-templates" && !gymAdmin(actor.role))
    scope.createdBy = actor.userId;
  if (entity === "package-templates" && !gymAdmin(actor.role))
    scope.status = "ACTIVE";
  if (entity === "knowledge" && !gymAdmin(actor.role))
    scope.status = "PUBLISHED";
  return scope;
}
export async function getRecord(
  actor: GymActor,
  entity: GymEntity,
  id: string,
  session?: ClientSession,
) {
  const item = await records(entity).findOne(
    { ...(await queryScope(actor, entity)), _id: recordId(id) },
    { session },
  );
  if (!item)
    throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy dữ liệu.");
  return item;
}
export function publicRecord(record: GymRecord) {
  const { companyCode, branchId, createdBy, accessVersion, ...value } = record;
  return value;
}
export async function listRecords(
  actor: GymActor,
  entity: GymEntity,
  query: Record<string, unknown>,
) {
  const page = Math.max(1, Math.min(10000, Number(query.page) || 1));
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
  const scope = await queryScope(actor, entity);
  const filters: Filter<GymRecord>[] = [scope];
  if (query.customerId)
    filters.push({ customerId: recordId(query.customerId) });
  for (const field of ["status", "publicationStatus", "topic", "category", "source"])
    if (
      typeof query[field] === "string" &&
      query[field] !== "ALL" &&
      query[field]
    )
      filters.push(entity === "measurements" && field === "status" && query[field] === "DRAFT"
        ? { $or: [{ status: "DRAFT" }, { status: { $exists: false } }] }
        : entity === "workout-plans" && field === "publicationStatus" && query[field] === "DRAFT"
        ? { $or: [{ publicationStatus: "DRAFT" }, { publicationStatus: { $exists: false } }] }
        : { [field]: query[field] });
  if (typeof query.search === "string" && query.search.trim()) {
    const search = query.search
      .trim()
      .slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filters.push({
      $or: ["fullName", "phone", "initialGoal", "title", "name", "description"].map(
        (field) => ({ [field]: { $regex: search, $options: "i" } }),
      ),
    });
  }
  const filter = { $and: filters };
  const [data, total] = await Promise.all([
    records(entity)
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    records(entity).countDocuments(filter),
  ]);
  return {
    data: data.map(publicRecord),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
export async function assertTrainer(actor: GymActor, id: string) {
  const user = await UserModel.findOne({
    _id: recordId(id),
    ...tenantFilter(actor),
    role: { $in: ["pt", "admin"] },
    isActive: { $ne: false },
    disabledAt: null,
    lockedAt: null,
  })
    .select("displayName")
    .lean();
  if (!user)
    throw new ValidationError(
      "VALIDATION_FAILED",
      "PT tiếp nhận không hoạt động hoặc không thuộc chi nhánh.",
    );
  return user;
}
export async function lockCustomer(
  actor: GymActor,
  customerId: string,
  session: ClientSession,
) {
  const customer = await records("customers").findOneAndUpdate(
    { ...customerFilter(actor), _id: recordId(customerId) },
    { $inc: { accessVersion: 1 } },
    { session, returnDocument: "after" },
  );
  if (!customer)
    throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy khách hàng.");
  return customer;
}
export function assertWrite(
  actor: GymActor,
  entity: GymEntity,
  existing?: GymRecord,
) {
  if (
    entity === "knowledge" ||
    entity === "package-templates" ||
    entity === "transfers" ||
    (entity === "food-images" && existing)
  )
    assertGymAdmin(actor);
}
export async function saveRecord(
  actor: GymActor,
  entity: GymEntity,
  input: unknown,
  id?: string,
) {
  const value = validateInput(entity, input);
  if (entity === "transfers")
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Sử dụng thao tác điều chuyển khách.",
    );
  return mongoose.connection.transaction(async (session) => {
    if (entity === "sessions" && !id && value.idempotencyKey) {
      const existing = await records("sessions").findOne(
        { ...tenantFilter(actor), createdBy: actor.userId, idempotencyKey: value.idempotencyKey },
        { session },
      );
      if (existing) return publicRecord(existing);
    }
    const previous = id
      ? await getRecord(actor, entity, id, session)
      : undefined;
    assertWrite(actor, entity, previous);
    if (previous && value.revision !== previous.revision)
      throw new ConflictError(
        "CONFLICT",
        "Dữ liệu đã thay đổi. Vui lòng tải lại.",
      );
    if (
      previous &&
      customerEntities.has(entity) &&
      previous.customerId !== value.customerId
    )
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Không được đổi khách hàng của hồ sơ.",
      );
    if (customerEntities.has(entity))
      await lockCustomer(actor, value.customerId, session);
    if (entity === "packages" && previous && Number(previous.usedSessions || 0) > Number(value.totalSessions))
      throw new ValidationError("VALIDATION_FAILED", "Tổng số buổi không được nhỏ hơn số buổi đã sử dụng.");
    if (entity === "workout-plans" && previous?.status === "ARCHIVED")
      throw new ValidationError("VALIDATION_FAILED", "Không thể sửa giáo án đã lưu trong lịch sử.");
    if (entity === "progress-reports" && value.periodStart > value.periodEnd)
      throw new ValidationError("VALIDATION_FAILED", "Ngày bắt đầu báo cáo phải trước ngày kết thúc.");
    if (entity === "progress-reports" && previous && input && typeof input === "object") {
      const supplied = input as Record<string, unknown>;
      for (const field of ["metrics", "sourceVersions", "warnings", "generatorVersion"])
        if (!Object.prototype.hasOwnProperty.call(supplied, field)) value[field] = previous[field];
    }
    if (entity === "workout-templates" && value.generatedExercises?.length) {
      const ids = new Map<string, string>();
      const draftIds = new Map<string, string>();
      for (const generated of value.generatedExercises as GymRecord[]) {
        const name = String(generated.name || "").trim();
        const normalized = name.toLocaleLowerCase("vi");
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        let exercise = await records("exercises").findOne(
          { ...tenantFilter(actor), name: { $regex: `^${escaped}$`, $options: "i" } },
          { session },
        );
        if (!exercise) {
          const created = validateInput("exercises", {
            name, muscleGroup: generated.muscleGroup, level: generated.level,
            equipment: generated.equipment, description: generated.description,
            instructions: generated.technique || generated.instructions || "",
            commonMistakes: generated.commonMistakes || [],
            contraindications: generated.contraindications || [],
            variants: generated.variants || [],
            trackingType: generated.trackingType || generated.defaultTrackingType || "STRENGTH",
          });
          exercise = { ...created, _id: new ObjectId().toHexString(), revision: 1,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            ...tenantFilter(actor), createdBy: actor.userId };
          await records("exercises").insertOne(exercise, { session });
        }
        ids.set(normalized, exercise._id);
        if (generated.draftId) draftIds.set(generated.draftId, exercise._id);
      }
      for (const field of ["scheduledExercises", "unscheduledExercises"] as const)
        value[field] = (value[field] || []).map((item: GymRecord) => ({
          ...item, exerciseId: draftIds.get(item.exerciseId) || item.exerciseId || ids.get(String(item.name || "").trim().toLocaleLowerCase("vi")),
        }));
      value.schedule = (value.schedule || []).map((day: GymRecord) => ({
        ...day, exercises: (day.exercises || []).map((item: GymRecord) => ({
          ...item, exerciseId: draftIds.get(item.exerciseId) || item.exerciseId || ids.get(String(item.name || "").trim().toLocaleLowerCase("vi")),
        })),
      }));
    }
    if (entity === "workout-templates") delete value.generatedExercises;
    if (entity === "workout-plans" && value.sessions?.length) {
      const unclassified = value.sessions.flatMap((item: GymRecord) => item.exercises || []).find((item: GymRecord) => !item.trackingType || item.trackingType === "UNCLASSIFIED");
      if (unclassified) throw new ValidationError("VALIDATION_FAILED", `Bài tập ${unclassified.name || "chưa đặt tên"} chưa có cách ghi nhận.`);
      value.schedule = value.sessions.map((item: GymRecord, index: number) => ({ day: index + 1, title: item.name, exercises: item.exercises }));
    }
    let sessionPlan: GymRecord | undefined;
    if (entity === "sessions") {
      const plan = await getRecord(
        actor,
        "workout-plans",
        value.planId,
        session,
      );
      if (plan.customerId !== value.customerId)
        throw new ValidationError(
          "VALIDATION_FAILED",
          "Giáo án không thuộc khách hàng đã chọn.",
        );
      if (!previous && plan.status !== "ACTIVE")
        throw new ValidationError("VALIDATION_FAILED", "Giáo án này không còn được áp dụng.");
      if (value.planRevision && value.planRevision !== plan.revision)
        throw new ConflictError("CONFLICT", "Giáo án đã thay đổi. Vui lòng tải lại.");
      if (value.sessionIndex != null) {
        const selectedDay = plan.schedule?.[value.sessionIndex];
        if (!selectedDay)
          throw new ValidationError("VALIDATION_FAILED", "Buổi tập trong giáo án không hợp lệ.");
        const plannedExercises = selectedDay.exercises || [];
        const loggedExercises = value.exerciseLogs || [];
        if (value.attendance === "ABSENT" ? loggedExercises.length > 0 : plannedExercises.length !== loggedExercises.length || plannedExercises.some((exercise: GymRecord, index: number) => exercise.exerciseId ? exercise.exerciseId !== loggedExercises[index]?.exerciseId : exercise.name !== loggedExercises[index]?.name))
          throw new ValidationError("VALIDATION_FAILED", "Kết quả bài tập không khớp với buổi đã chọn.");
      }
      if (value.attendance === "ABSENT" && (value.bodyMeasurement || value.progressPhotos?.length || value.customerSignature))
        throw new ValidationError("VALIDATION_FAILED", "Buổi vắng không có chỉ số, ảnh hoặc chữ ký.");
      sessionPlan = plan;
    }
    if (entity === "progress-photos") await getRecord(actor, "customers", value.customerId, session);
    for (const exercise of [
      ...(value.schedule || []).flatMap((d: any) => d.exercises),
      ...(value.exerciseLogs || []),
    ])
      if (exercise.exerciseId) await getRecord(actor, "exercises", exercise.exerciseId, session);
    const now = new Date().toISOString();
    const payload = {
      ...value,
      ...(entity === "workout-plans" ? {
        publicationStatus: "DRAFT",
        publishedAt: null,
        version: Number(previous?.version || 0) + 1,
      } : {}),
      ...(entity === "workout-templates" ? { version: Number(previous?.version || 0) + 1 } : {}),
      ...(entity === "nutrition-plans" ? { status: "DRAFT", publishedAt: null, version: Number(previous?.version || 0) + 1 } : {}),
      ...(entity === "measurements" ? { status: "DRAFT", publishedAt: null } : {}),
      ...(entity === "progress-reports" ? { status: "DRAFT", publishedAt: null, version: Number(previous?.version || 0) + 1 } : {}),
      ...(entity === "packages" ? {
        usedSessions: Number(previous?.usedSessions || 0),
        remainingSessions: Number(value.totalSessions) - Number(previous?.usedSessions || 0),
      } : {}),
      ...(entity === "sessions" && sessionPlan && !previous ? {
        planSnapshot: {
          title: sessionPlan.title,
          revision: sessionPlan.revision,
          sessionIndex: value.sessionIndex,
          session: value.sessionIndex != null ? sessionPlan.schedule?.[value.sessionIndex] : undefined,
        },
      } : {}),
      ...(entity === "sessions" ? { photoSyncVersion: 1 } : {}),
      updatedAt: now,
      revision: (previous?.revision || 0) + 1,
    };
    if (previous) {
      const updated = await records(entity).findOneAndUpdate(
        {
          _id: previous._id,
          ...tenantFilter(actor),
          revision: previous.revision,
        },
        { $set: payload },
        { session, returnDocument: "after" },
      );
      if (!updated)
        throw new ConflictError(
          "CONFLICT",
          "Dữ liệu đã thay đổi. Vui lòng tải lại.",
        );
      if (entity === "sessions" && value.bodyMeasurement?.weight) {
        const measurement = { ...value.bodyMeasurement, measurementDate: value.performedAt.slice(0, 10), weight: value.bodyMeasurement.weight, updatedAt: now };
        await records("measurements").updateOne(
          { ...tenantFilter(actor), customerId: value.customerId, sessionId: previous._id },
          { $set: measurement },
          { session },
        );
      }
      if (entity === "sessions") {
        await records("progress-photos").deleteMany({ ...tenantFilter(actor), sessionId: previous._id }, { session });
        if (value.attendance !== "ABSENT" && value.progressPhotos?.length) await records("progress-photos").insertMany(
          value.progressPhotos.map((photo: GymRecord) => ({
            _id: new ObjectId().toHexString(), ...tenantFilter(actor), customerId: value.customerId,
            sessionId: previous._id, photoUrl: photo.photoUrl, takenDate: value.performedAt,
            stage: "PROGRESS", angle: photo.angle, weight: value.bodyMeasurement?.weight ?? null,
            bodyFat: value.bodyMeasurement?.bodyFatPercentage ?? null, notes: "Ảnh ghi nhận cùng buổi tập",
            createdBy: actor.userId, revision: 1, createdAt: now, updatedAt: now,
          })), { session },
        );
      }
      if (entity === "knowledge") {
        const count = await indexKnowledge(actor, updated._id, updated.revision, updated.topic, updated.content, session);
        await records("knowledge").updateOne({ _id: updated._id, ...tenantFilter(actor) }, { $set: { ragChunkCount: count } }, { session });
        return publicRecord({ ...updated, ragChunkCount: count });
      }
      return publicRecord(updated);
    }
    const item: GymRecord = {
      ...payload,
      _id: new ObjectId().toHexString(),
      createdAt: now,
      ...tenantFilter(actor),
      createdBy: actor.userId,
    };
    if (entity === "customers") item.assignedPtId = actor.userId;
    if (entity === "knowledge") item.status = "DRAFT";
    if (entity === "workout-plans") {
      await records("workout-plans").updateMany(
        { ...tenantFilter(actor), customerId: value.customerId, status: "ACTIVE" },
        { $set: { status: "ARCHIVED", archivedAt: now, updatedAt: now }, $inc: { revision: 1 } },
        { session },
      );
    }
    await records(entity).insertOne(item, { session });
    if (entity === "knowledge") {
      const count = await indexKnowledge(actor, item._id, item.revision, item.topic, item.content, session);
      await records("knowledge").updateOne({ _id: item._id, ...tenantFilter(actor) }, { $set: { ragChunkCount: count } }, { session });
      item.ragChunkCount = count;
    }
    if (entity === "sessions") {
      if (value.attendance !== "ABSENT" && value.progressPhotos?.length) await records("progress-photos").insertMany(
        value.progressPhotos.map((photo: GymRecord) => ({
          _id: new ObjectId().toHexString(), ...tenantFilter(actor), customerId: value.customerId,
          sessionId: item._id, photoUrl: photo.photoUrl, takenDate: value.performedAt,
          stage: "PROGRESS", angle: photo.angle, weight: value.bodyMeasurement?.weight ?? null,
          bodyFat: value.bodyMeasurement?.bodyFatPercentage ?? null, notes: "Ảnh ghi nhận cùng buổi tập",
          createdBy: actor.userId, revision: 1, createdAt: now, updatedAt: now,
        })), { session },
      );
      if (value.bodyMeasurement?.weight) {
        await records("measurements").insertOne({
          _id: new ObjectId().toHexString(),
          ...tenantFilter(actor),
          customerId: value.customerId,
          sessionId: item._id,
          measurementDate: value.performedAt.slice(0, 10),
          ...value.bodyMeasurement,
          revision: 1,
          createdBy: actor.userId,
          createdAt: now,
          updatedAt: now,
        }, { session });
      }
      if (value.attendance !== "ABSENT") {
        const activePackage = await records("packages").findOne(
          { ...tenantFilter(actor), customerId: value.customerId, status: "ACTIVE" },
          { session, sort: { endDate: 1 } },
        );
        if (activePackage && (activePackage.usedSessions || 0) < activePackage.totalSessions) {
          const completing = (activePackage.usedSessions || 0) + 1 >= activePackage.totalSessions;
          await records("packages").updateOne(
            { _id: activePackage._id, ...tenantFilter(actor), revision: activePackage.revision },
            { $inc: { usedSessions: 1, revision: 1 }, $set: { remainingSessions: activePackage.totalSessions - (activePackage.usedSessions || 0) - 1, updatedAt: now, ...(completing ? { status: "COMPLETED" } : {}) } },
            { session },
          );
        }
      }
    }
    return publicRecord(item);
  });
}
export async function removeRecord(
  actor: GymActor,
  entity: GymEntity,
  id: string,
  revision: number,
) {
  return mongoose.connection.transaction(async (session) => {
    const item = await getRecord(actor, entity, id, session);
    assertWrite(actor, entity, item);
    if (entity === "progress-reports" && item.status === "PUBLISHED")
      throw new ValidationError("VALIDATION_FAILED", "Chỉ có thể xóa báo cáo chưa công bố.");
    if (entity === "transfers")
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Không được xóa lịch sử điều chuyển.",
      );
    if (item.revision !== revision)
      throw new ConflictError(
        "CONFLICT",
        "Dữ liệu đã thay đổi. Vui lòng tải lại.",
      );
    if (customerEntities.has(entity))
      await lockCustomer(actor, item.customerId, session);
    if (entity === "customers") {
      await lockCustomer(actor, item._id, session);
      for (const child of [...customerEntities, "transfers"] as GymEntity[]) {
        if (
          await records(child).findOne(
            { ...tenantFilter(actor), customerId: item._id },
            { session, projection: { _id: 1 } },
          )
        )
          throw new ConflictError(
            "CONFLICT",
            "Khách hàng đã có dữ liệu liên quan. Hãy chuyển sang Ngừng hoạt động.",
          );
      }
    }
    if (
      entity === "workout-plans" &&
      (await records("sessions").findOne(
        { ...tenantFilter(actor), planId: item._id },
        { session },
      ))
    )
      throw new ConflictError(
        "CONFLICT",
        "Không thể xóa giáo án đã có lịch sử tập.",
      );
    await records(entity).deleteOne(
      { _id: item._id, ...tenantFilter(actor), revision },
      { session },
    );
    if (entity === "knowledge") await removeKnowledgeIndex(actor, item._id, session);
    if (entity === "sessions") {
      await records("measurements").deleteMany({ ...tenantFilter(actor), sessionId: item._id }, { session });
      await records("progress-photos").deleteMany({ ...tenantFilter(actor), sessionId: item._id }, { session });
    }
  });
}
