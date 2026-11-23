import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { UserModel } from "../../model/user.model";
import { ConflictError, NotFoundError, ValidationError } from "../../errors/app-error";
import { gymAdmin, type GymRecord } from "../../../shared/gym/types";
import {
  assertGymAdmin,
  customerFilter,
  tenantFilter,
  type GymActor,
} from "./access";
import {
  assertTrainer,
  getRecord,
  lockCustomer,
  publicRecord,
  records,
  recordId,
  saveRecord,
} from "./store";
import { validateInput } from "./validation";
import { indexKnowledge } from "./knowledge-index";

export async function trainers(actor: GymActor) {
  assertGymAdmin(actor);
  const users = await UserModel.find({
    companyCode: actor.companyCode,
    $or: [
      { branchId: actor.branchId },
      { branchId: { $in: [null, ""] } },
      { branchId: { $exists: false } },
    ],
    role: "pt",
    disabledAt: null,
  })
    .select("displayName email phone role lockedAt birthDate gymProfile gymProfileRevision")
    .sort({ displayName: 1, _id: 1 })
    .lean();
  return Promise.all(
    users.map(async (user) => ({
      _id: String(user._id),
      displayName: user.displayName,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      locked: Boolean(user.lockedAt),
      status: user.lockedAt ? "LOCKED" : "ACTIVE",
      gender: user.gymProfile?.gender || "OTHER",
      dateOfBirth: user.birthDate ? new Date(user.birthDate).toISOString().slice(0, 10) : "",
      address: user.gymProfile?.address || "",
      specialization: user.gymProfile?.specialization || "",
      yearsOfExperience: user.gymProfile?.yearsOfExperience || 0,
      certificates: user.gymProfile?.certificates || [],
      bio: user.gymProfile?.bio || "",
      avatarUrl: user.gymProfile?.avatarUrl || "",
      revision: user.gymProfileRevision || 1,
      customerCount: await records("customers").countDocuments({
        ...tenantFilter(actor),
        assignedPtId: String(user._id),
      }),
    })),
  );
}
export async function trainerPage(actor: GymActor, query: Record<string, unknown>) {
  const all = await trainers(actor);
  const keyword = String(query.search || "").trim().toLocaleLowerCase("vi");
  const status = String(query.status || "").toUpperCase();
  const filtered = all.filter(item => (!keyword || String(item.displayName || "").toLocaleLowerCase("vi").includes(keyword) || String(item.email || "").toLocaleLowerCase("vi").includes(keyword))
    && (!status || item.status === status));
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const limit = Math.max(1, Math.min(100, Math.floor(Number(query.limit) || 18)));
  return { data: filtered.slice((page - 1) * limit, page * limit), meta: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) } };
}

function trainerProfile(input: Record<string, unknown>) {
  const yearsOfExperience = Number(input.yearsOfExperience || 0);
  if (!Number.isFinite(yearsOfExperience) || yearsOfExperience < 0 || yearsOfExperience > 70)
    throw new ValidationError("VALIDATION_FAILED", "Số năm kinh nghiệm không hợp lệ.");
  const gender = String(input.gender || "OTHER").toUpperCase();
  if (!["MALE", "FEMALE", "OTHER"].includes(gender)) throw new ValidationError("VALIDATION_FAILED", "Giới tính không hợp lệ.");
  const certificates = Array.isArray(input.certificates) ? input.certificates.map(value => String(value).trim()).filter(Boolean) : [];
  if (certificates.length > 30) throw new ValidationError("VALIDATION_FAILED", "Danh sách chứng chỉ quá dài.");
  const avatarUrl = String(input.avatarUrl || "").trim();
  if (avatarUrl && !/^https:\/\//i.test(avatarUrl)) throw new ValidationError("VALIDATION_FAILED", "Ảnh đại diện cần dùng liên kết HTTPS.");
  return { gender, address: String(input.address || "").trim().slice(0, 500), specialization: String(input.specialization || "").trim().slice(0, 200),
    yearsOfExperience, certificates, bio: String(input.bio || "").trim().slice(0, 5000), avatarUrl };
}

export async function createTrainer(
  actor: GymActor,
  input: Record<string, unknown>,
) {
  assertGymAdmin(actor);
  const displayName = String(input.displayName || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const phone = String(input.phone || "").trim();
  const password = String(input.password || "");
  const requestedStatus = String(input.status || "ACTIVE").toUpperCase();
  if (!["ACTIVE", "LOCKED"].includes(requestedStatus)) throw new ValidationError("VALIDATION_FAILED", "Trạng thái PT không hợp lệ.");
  const locked = requestedStatus === "LOCKED";
  const profile = trainerProfile(input);
  const birthDate = input.dateOfBirth ? new Date(String(input.dateOfBirth)) : null;
  if (birthDate && Number.isNaN(birthDate.getTime())) throw new ValidationError("VALIDATION_FAILED", "Ngày sinh không hợp lệ.");

  if (!displayName) {
    throw new ValidationError("VALIDATION_FAILED", "Vui lòng nhập họ tên huấn luyện viên.");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("VALIDATION_FAILED", "Vui lòng nhập email đăng nhập hợp lệ.");
  }
  if (password.length < 6) {
    throw new ValidationError("VALIDATION_FAILED", "Mật khẩu ban đầu cần tối thiểu 6 ký tự.");
  }

  const existing = await UserModel.findOne({ email }).select("_id").lean();
  if (existing) {
    throw new ConflictError("CONFLICT", "Email này đã tồn tại trong hệ thống.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const created = await UserModel.create({
    displayName,
    email,
    phone,
    gymProfile: profile,
    birthDate,
    password: hashedPassword,
    role: "pt",
    jobTitle: "Huấn luyện viên (PT)",
    companyCode: actor.companyCode,
    branchId: actor.branchId,
    permissions: ["gym:manage"],
    isActive: !locked,
    lockedAt: locked ? new Date() : null,
  });

  return {
    _id: String(created._id),
    displayName: created.displayName,
    email: created.email,
    phone: created.phone || "",
    role: created.role,
    locked,
    status: locked ? "LOCKED" : "ACTIVE",
    ...profile,
    dateOfBirth: input.dateOfBirth || "",
    revision: 1,
    customerCount: 0,
  };
}
export async function updateTrainer(actor: GymActor, id: string, input: Record<string, unknown>) {
  assertGymAdmin(actor);
  const trainerId = recordId(id);
  const current = await UserModel.findOne({ _id: trainerId, companyCode: actor.companyCode, branchId: actor.branchId, role: "pt", disabledAt: null });
  if (!current) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy huấn luyện viên.");
  if (Number(input.revision) !== (current.gymProfileRevision || 1)) throw new ConflictError("CONFLICT", "Hồ sơ PT đã thay đổi. Vui lòng tải lại.");
  const displayName = String(input.displayName || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  if (!displayName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("VALIDATION_FAILED", "Nhập họ tên và email hợp lệ.");
  if (email !== current.email && await UserModel.exists({ email, _id: { $ne: current._id } })) throw new ConflictError("CONFLICT", "Email này đã tồn tại.");
  const dateOfBirth = input.dateOfBirth ? new Date(String(input.dateOfBirth)) : null;
  if (dateOfBirth && Number.isNaN(dateOfBirth.getTime())) throw new ValidationError("VALIDATION_FAILED", "Ngày sinh không hợp lệ.");
  const requestedStatus = String(input.status || "ACTIVE").toUpperCase();
  if (!["ACTIVE", "LOCKED"].includes(requestedStatus)) throw new ValidationError("VALIDATION_FAILED", "Trạng thái PT không hợp lệ.");
  const locked = requestedStatus === "LOCKED";
  const updated = await UserModel.findOneAndUpdate(
    { _id: current._id, $or: [{ gymProfileRevision: current.gymProfileRevision || 1 }, { gymProfileRevision: { $exists: false } }] },
    { $set: { displayName, email, phone: String(input.phone || "").trim(), birthDate: dateOfBirth, gymProfile: trainerProfile(input),
      isActive: !locked, lockedAt: locked ? new Date() : null }, $inc: { gymProfileRevision: 1 } },
    { returnDocument: "after" },
  );
  if (!updated) throw new ConflictError("CONFLICT", "Hồ sơ PT đã thay đổi. Vui lòng tải lại.");
  return (await trainers(actor)).find(item => item._id === trainerId);
}
export async function deleteTrainer(actor: GymActor, id: string) {
  assertGymAdmin(actor);
  const trainerId = recordId(id);
  const trainer = await UserModel.findOne({ _id: trainerId, companyCode: actor.companyCode, branchId: actor.branchId, role: "pt", disabledAt: null });
  if (!trainer) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy huấn luyện viên.");
  const assigned = await records("customers").countDocuments({ ...tenantFilter(actor), assignedPtId: trainerId });
  if (assigned) throw new ConflictError("CONFLICT", "PT còn học viên phụ trách. Hãy điều chuyển trước khi xóa.");
  await UserModel.updateOne({ _id: trainer._id }, { $set: { isActive: false, disabledAt: new Date(), lockedAt: new Date() } });
  return { message: "Đã xóa huấn luyện viên khỏi danh sách." };
}
export async function transfer(actor: GymActor, input: unknown) {
  assertGymAdmin(actor);
  const value = validateInput("transfers", input);
  const receiver = await assertTrainer(actor, value.toPtId);
  return mongoose.connection.transaction(async (session) => {
    const customer = await lockCustomer(actor, value.customerId, session);
    if (customer.revision !== value.revision)
      throw new ConflictError(
        "CONFLICT",
        "Khách hàng đã thay đổi. Vui lòng tải lại trước khi điều chuyển.",
      );
    if (customer.assignedPtId === value.toPtId)
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Khách hàng đang được PT này phụ trách.",
      );
    const now = new Date().toISOString();
    const fromUser = customer.assignedPtId
      ? await UserModel.findById(customer.assignedPtId).select("displayName").lean()
      : null;
    const log = {
      _id: new ObjectId().toHexString(),
      ...tenantFilter(actor),
      customerId: customer._id,
      customerName: customer.fullName,
      fromPtId: customer.assignedPtId,
      fromPtName: fromUser?.displayName || "",
      toPtId: value.toPtId,
      toPtName: receiver.displayName,
      reason: value.reason,
      status: "ADMIN_FORCED",
      resolvedById: actor.userId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    await records("transfers").insertOne(log, { session });
    await records("customers").updateOne(
      {
        ...tenantFilter(actor),
        _id: customer._id,
        revision: customer.revision,
      },
      {
        $set: { assignedPtId: value.toPtId, updatedAt: now },
        $inc: { revision: 1 },
      },
      { session },
    );
    return publicRecord(log);
  });
}

export async function transferBatch(actor: GymActor, input: Record<string, unknown>) {
  assertGymAdmin(actor);
  const ids = Array.isArray(input.customerIds)
    ? Array.from(new Set(input.customerIds.map((id) => String(id || "").trim()).filter((id) => /^[a-f0-9]{24}$/i.test(id))))
    : [];
  const toPtId = recordId(String(input.toPtId || ""));
  const reason = String(input.reason || "").trim();
  if (!ids.length) {
    throw new ValidationError("VALIDATION_FAILED", "Vui lòng chọn ít nhất 1 khách hàng để điều chuyển.");
  }
  if (!reason) {
    throw new ValidationError("VALIDATION_FAILED", "Vui lòng nhập lý do điều chuyển.");
  }
  const receiver = await assertTrainer(actor, toPtId);
  const now = new Date().toISOString();
  const moved: any[] = [];
  const skipped: string[] = [];

  for (const cid of ids) {
    const customer = await records("customers").findOne({ ...tenantFilter(actor), _id: cid });
    if (!customer || customer.assignedPtId === toPtId) {
      skipped.push(cid);
      continue;
    }
    const fromUser = customer.assignedPtId
      ? await UserModel.findById(customer.assignedPtId).select("displayName").lean()
      : null;
    const log = {
      _id: new ObjectId().toHexString(),
      ...tenantFilter(actor),
      customerId: customer._id,
      customerName: customer.fullName,
      fromPtId: customer.assignedPtId,
      fromPtName: fromUser?.displayName || "",
      toPtId,
      toPtName: receiver.displayName,
      reason,
      status: "ADMIN_FORCED",
      resolvedById: actor.userId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };
    await records("transfers").insertOne(log);
    await records("customers").updateOne(
      { ...tenantFilter(actor), _id: customer._id },
      { $set: { assignedPtId: toPtId, updatedAt: now }, $inc: { revision: 1 } },
    );
    moved.push(publicRecord(log));
  }

  return { movedCount: moved.length, skippedCount: skipped.length, data: moved };
}

export async function requestTransfer(actor: GymActor, input: Record<string, unknown>) {
  const cid = recordId(String(input.customerId || ""));
  const toPtId = recordId(String(input.toPtId || ""));
  const reason = String(input.reason || "").trim();
  if (!reason) {
    throw new ValidationError("VALIDATION_FAILED", "Vui lòng nhập lý do đề xuất điều chuyển.");
  }
  const receiver = await assertTrainer(actor, toPtId);
  const customer = await records("customers").findOne({ ...customerFilter(actor), _id: cid });
  if (!customer) {
    throw new ValidationError("VALIDATION_FAILED", "Không tìm thấy khách hàng thuộc quyền phụ trách của bạn.");
  }
  if (customer.assignedPtId === toPtId) {
    throw new ValidationError("VALIDATION_FAILED", "Khách hàng đang được huấn luyện viên này phụ trách.");
  }
  const existingPending = await records("transfers").findOne({
    ...tenantFilter(actor),
    customerId: cid,
    status: "PENDING",
  });
  if (existingPending) {
    throw new ConflictError("CONFLICT", "Khách hàng này đang có 1 yêu cầu điều chuyển chờ duyệt.");
  }
  const now = new Date().toISOString();
  const fromPtId = customer.assignedPtId || actor.userId;
  const fromUser = fromPtId
    ? await UserModel.findById(fromPtId).select("displayName").lean()
    : null;
  const log = {
    _id: new ObjectId().toHexString(),
    ...tenantFilter(actor),
    customerId: customer._id,
    customerName: customer.fullName,
    fromPtId,
    fromPtName: fromUser?.displayName || "",
    toPtId,
    toPtName: receiver.displayName,
    reason,
    status: "PENDING",
    requestedById: actor.userId,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  };
  await records("transfers").insertOne(log);
  return publicRecord(log);
}

export async function respondTransfer(
  actor: GymActor,
  id: string,
  action: "accept" | "reject" | "cancel" | "approve",
) {
  const tid = recordId(id);
  const reqDoc = await records("transfers").findOne({ ...tenantFilter(actor), _id: tid });
  if (!reqDoc) {
    throw new ValidationError("VALIDATION_FAILED", "Không tìm thấy yêu cầu điều chuyển.");
  }
  if (reqDoc.status !== "PENDING") {
    throw new ConflictError("CONFLICT", "Yêu cầu điều chuyển này đã được xử lý trước đó.");
  }
  const isAdmin = gymAdmin(actor.role);
  if (action === "approve") assertGymAdmin(actor);
  if ((action === "accept" || action === "reject") && !isAdmin && reqDoc.toPtId !== actor.userId) {
    throw new ValidationError("VALIDATION_FAILED", "Chỉ huấn luyện viên tiếp nhận hoặc Admin mới có thể duyệt yêu cầu này.");
  }
  if (action === "cancel" && !isAdmin && reqDoc.fromPtId !== actor.userId && reqDoc.requestedById !== actor.userId) {
    throw new ValidationError("VALIDATION_FAILED", "Chỉ người đề xuất hoặc Admin mới có thể hủy yêu cầu này.");
  }

  const now = new Date().toISOString();
  const nextStatus =
    action === "accept"
      ? "ACCEPTED"
      : action === "approve"
        ? "ADMIN_FORCED"
        : action === "reject"
          ? "REJECTED"
          : "CANCELLED";

  await records("transfers").updateOne(
    { ...tenantFilter(actor), _id: tid, status: "PENDING" },
    { $set: { status: nextStatus, resolvedById: actor.userId, updatedAt: now }, $inc: { revision: 1 } },
  );

  if (action === "accept" || action === "approve") {
    await records("customers").updateOne(
      { ...tenantFilter(actor), _id: reqDoc.customerId },
      { $set: { assignedPtId: reqDoc.toPtId, updatedAt: now }, $inc: { revision: 1 } },
    );
  }

  const updated = await records("transfers").findOne({ ...tenantFilter(actor), _id: tid });
  return publicRecord(updated || { ...reqDoc, status: nextStatus });
}

export async function publishRoadmap(
  actor: GymActor,
  id: string,
  revision: number,
  publish: boolean,
) {
  const result = await records("roadmaps").findOneAndUpdate(
    { ...tenantFilter(actor), _id: recordId(id), revision },
    {
      $set: {
        status: publish ? "PUBLISHED" : "DRAFT",
        updatedAt: new Date().toISOString(),
      },
      $inc: { revision: 1 },
    },
    { returnDocument: "after" },
  );
  if (!result) {
    throw new ConflictError("CONFLICT", "Lộ trình đã thay đổi hoặc không tồn tại. Vui lòng tải lại.");
  }
  return publicRecord(result);
}

export async function seedStandardKnowledge(actor: GymActor) {
  assertGymAdmin(actor);
  const standards = [
    {
      title: "Quy trình đọc & tư vấn chỉ số InBody chuẩn PT",
      topic: "INBODY",
      content:
        "1. Đánh giá tổng quan điểm InBody, cân nặng, khối lượng cơ xương (SMM) và tỷ lệ % mỡ (PBF).\n2. Ngưỡng % mỡ lý tưởng: Nam 10–20%, Nữ 18–28%. Mỡ nội tạng (VFL) an toàn ≤ Level 9.\n3. Khi tư vấn, ưu tiên chỉ ra 2 điểm mạnh trước rồi mới đề xuất 2 ưu tiên cải thiện và lộ trình 8–12 tuần.",
    },
    {
      title: "Nguyên tắc tính TDEE, thâm hụt calo và phân bổ Macro an toàn",
      topic: "NUTRITION",
      content:
        "1. BMR tính theo Mifflin-St Jeor hoặc chỉ số InBody.\n2. Giảm mỡ bền vững: thâm hụt 300–500 kcal/ngày (tốc độ 0.4–0.7 kg/tuần), đạm 1.8–2.2g/kg cân nặng.\n3. Tăng cơ nạc: thặng dư 200–350 kcal/ngày, đạm 1.6–2.0g/kg, ngủ đủ 7–8 tiếng.",
    },
    {
      title: "Nguyên tắc Quá tải lũy tiến (Progressive Overload) & RPE/RIR",
      topic: "WORKOUT",
      content:
        "1. Người mới tập (4–8 tuần đầu): ưu tiên chuẩn hóa kỹ thuật, RPE 6–7 (RIR 3–4).\n2. Tăng tiến theo thứ tự: chuẩn form → tăng reps trong ngưỡng mục tiêu → tăng tạ 2.5–5%.\n3. Ghi nhận đầy đủ mức tạ và số reps sau mỗi buổi để theo dõi tiến bộ liên tục.",
    },
    {
      title: "Quy chuẩn sàng lọc chấn thương & an toàn tập luyện cho học viên",
      topic: "GENERAL",
      content:
        "1. Trước buổi tập đầu tiên, PT bắt buộc rà soát tiền sử thoát vị đĩa đệm, đau khớp gối, huyết áp và tim mạch.\n2. Với học viên có chấn thương khớp gối hoặc lưng dưới, tránh tải trục nặng đột ngột và ưu tiên bài tập kiểm soát biên độ khớp (ROM).\n3. Dừng bài ngay khi xuất hiện đau nhói khớp, chóng mặt hoặc khó thở bất thường và ghi nhận vào lưu ý sức khỏe.",
    },
  ];
  const existing = await records("knowledge")
    .find(tenantFilter(actor))
    .project({ title: 1 })
    .limit(200)
    .toArray();
  const titles = new Set(existing.map((d) => String(d.title || "").trim().toLowerCase()));
  const now = new Date().toISOString();
  let inserted = 0;
  for (const item of standards) {
    if (titles.has(item.title.toLowerCase())) continue;
    const documentId = new ObjectId().toHexString();
    await records("knowledge").insertOne({
      _id: documentId,
      ...tenantFilter(actor),
      ...item,
      status: "PUBLISHED",
      publishedAt: now,
      revision: 1,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    });
    const count = await indexKnowledge(actor, documentId, 1, item.topic, item.content);
    await records("knowledge").updateOne({ _id: documentId, ...tenantFilter(actor) }, { $set: { ragChunkCount: count } });
    inserted++;
  }
  return { insertedCount: inserted };
}
export async function assignPlan(
  actor: GymActor,
  customerId: string,
  templateId: string,
) {
  return mongoose.connection.transaction(async (session) => {
    await lockCustomer(actor, recordId(customerId), session);
    const template = await getRecord(
      actor,
      "workout-templates",
      templateId,
      session,
    );
    if (template.status === "ARCHIVED")
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Giáo án đã được lưu trữ.",
      );
    const schedule = await Promise.all((template.schedule || []).map(async (day: GymRecord) => ({
      ...day,
      exercises: await Promise.all((day.exercises || []).map(async (exercise: GymRecord) => {
        const catalog = exercise.exerciseId ? await getRecord(actor, "exercises", exercise.exerciseId, session) : undefined;
        return { ...exercise, trackingType: exercise.trackingType || catalog?.trackingType || "UNCLASSIFIED" };
      })),
    })));
    const now = new Date().toISOString();
    await records("workout-plans").updateMany(
      { ...tenantFilter(actor), customerId, status: "ACTIVE" },
      { $set: { status: "ARCHIVED", updatedAt: now }, $inc: { revision: 1 } },
      { session },
    );
    const plan = {
      _id: new ObjectId().toHexString(),
      ...tenantFilter(actor),
      customerId,
      templateId,
      title: template.title,
      description: template.description,
      goal: template.goal,
      durationWeeks: template.durationWeeks,
      durationDays: template.durationDays || (template.durationWeeks || 4) * 7,
      level: template.level,
      muscleGroups: template.muscleGroups || [],
      defaultSets: template.defaultSets,
      defaultReps: template.defaultReps,
      defaultWeight: template.defaultWeight,
      defaultTempo: template.defaultTempo,
      technicalNotes: template.technicalNotes,
      scheduledExercises: template.scheduledExercises || [],
      unscheduledExercises: template.unscheduledExercises || [],
      schedule,
      sessions: template.sessions || [],
      createdBy: actor.userId,
      status: "ACTIVE",
      publicationStatus: "DRAFT",
      publishedAt: null,
      version: 1,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    await records("workout-plans").insertOne(plan, { session });
    return publicRecord(plan);
  });
}
export async function publishKnowledge(
  actor: GymActor,
  id: string,
  revision: number,
  publish: boolean,
) {
  assertGymAdmin(actor);
  const result = await records("knowledge").findOneAndUpdate(
    { ...tenantFilter(actor), _id: recordId(id), revision },
    {
      $set: {
        status: publish ? "PUBLISHED" : "DRAFT",
        publishedAt: publish ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      },
      $inc: { revision: 1 },
    },
    { returnDocument: "after" },
  );
  if (!result)
    throw new ConflictError(
      "CONFLICT",
      "Tài liệu đã thay đổi hoặc không tồn tại. Vui lòng tải lại.",
    );
  return publicRecord(result);
}
export async function publishGoal(actor: GymActor, id: string, revision: number, publish: boolean) {
  const goal = await getRecord(actor, "goals", id);
  const now = new Date().toISOString();
  const result = await records("goals").findOneAndUpdate(
    { ...tenantFilter(actor), _id: goal._id, revision },
    { $set: { status: publish ? "PUBLISHED" : "DRAFT", publishedAt: publish ? now : null, updatedAt: now }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!result) throw new ConflictError("CONFLICT", "Mục tiêu đã thay đổi. Vui lòng tải lại.");
  return publicRecord(result);
}
export async function publishMeasurement(actor: GymActor, id: string, revision: number, publish: boolean) {
  const measurement = await getRecord(actor, "measurements", id);
  const now = new Date().toISOString();
  const result = await records("measurements").findOneAndUpdate(
    { ...tenantFilter(actor), _id: measurement._id, revision },
    { $set: { status: publish ? "PUBLISHED" : "DRAFT", publishedAt: publish ? now : null, updatedAt: now }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!result) throw new ConflictError("CONFLICT", "Phiếu InBody đã thay đổi. Vui lòng tải lại.");
  return publicRecord(result);
}
export async function publishWorkoutPlan(actor: GymActor, id: string, revision: number, publish: boolean) {
  const plan = await getRecord(actor, "workout-plans", id);
  if (plan.status !== "ACTIVE") throw new ValidationError("VALIDATION_FAILED", "Không thể công bố giáo án đã lưu trong lịch sử.");
  if (publish) {
    const unclassified = (plan.schedule || []).flatMap((day: GymRecord) => day.exercises || []).find((exercise: GymRecord) => !exercise.trackingType || exercise.trackingType === "UNCLASSIFIED");
    if (unclassified) throw new ValidationError("VALIDATION_FAILED", `Bài tập ${unclassified.name || "chưa đặt tên"} chưa có cách ghi nhận.`);
  }
  const now = new Date().toISOString();
  const result = await records("workout-plans").findOneAndUpdate(
    { ...tenantFilter(actor), _id: plan._id, revision },
    { $set: { publicationStatus: publish ? "PUBLISHED" : "DRAFT", publishedAt: publish ? now : null, updatedAt: now }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!result) throw new ConflictError("CONFLICT", "Giáo án đã thay đổi. Vui lòng tải lại.");
  return publicRecord(result);
}
export async function publishNutritionPlan(actor: GymActor, id: string, revision: number, publish: boolean) {
  const plan = await getRecord(actor, "nutrition-plans", id);
  const now = new Date().toISOString();
  const result = await records("nutrition-plans").findOneAndUpdate(
    { ...tenantFilter(actor), _id: plan._id, revision },
    { $set: { status: publish ? "PUBLISHED" : "DRAFT", publishedAt: publish ? now : null, updatedAt: now }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!result) throw new ConflictError("CONFLICT", "Thực đơn đã thay đổi. Vui lòng tải lại.");
  return publicRecord(result);
}
export async function generateProgressReport(actor: GymActor, input: Record<string, unknown>) {
  const customerId = recordId(String(input.customerId || ""));
  await getRecord(actor, "customers", customerId);
  const periodStart = String(input.periodStart || "").slice(0, 10);
  const periodEnd = String(input.periodEnd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodStart > periodEnd)
    throw new ValidationError("VALIDATION_FAILED", "Khoảng ngày báo cáo không hợp lệ.");
  const scope = { ...tenantFilter(actor), customerId };
  const [allSessions, allMeasurements] = await Promise.all([
    records("sessions").find(scope).sort({ performedAt: 1 }).toArray(),
    records("measurements").find(scope).sort({ measurementDate: 1 }).toArray(),
  ]);
  const inPeriod = (value: unknown) => String(value || "").slice(0, 10) >= periodStart && String(value || "").slice(0, 10) <= periodEnd;
  const sessions = allSessions.filter(item => inPeriod(item.performedAt));
  const measurements = allMeasurements.filter(item => inPeriod(item.measurementDate));
  const present = sessions.filter(item => item.attendance === "PRESENT").length;
  const late = sessions.filter(item => item.attendance === "LATE").length;
  const absent = sessions.filter(item => item.attendance === "ABSENT").length;
  const total = present + late + absent;
  const rate = total ? Math.round(((present + late) / total) * 1000) / 10 : null;
  const bodyDeltas: Record<string, number> = {};
  if (measurements.length >= 2) for (const key of ["weight", "bodyFatPercentage", "bodyFatMass", "muscleMass", "visceralFatLevel", "inbodyScore", "waist"]) {
    const first = measurements[0][key];
    const last = measurements.at(-1)?.[key];
    if (typeof first === "number" && typeof last === "number") bodyDeltas[key] = Math.round((last - first) * 10) / 10;
  }
  let totalVolume = 0;
  const rpes: number[] = [];
  for (const session of sessions) for (const exercise of session.exerciseLogs || []) {
    for (const set of exercise.result?.sets || []) {
      if (set.completed) totalVolume += Number(set.reps || 0) * Number(set.weight || set.addedWeight || 0);
      if (typeof set.rpe === "number") rpes.push(set.rpe);
    }
    if (typeof exercise.result?.rpe === "number") rpes.push(exercise.result.rpe);
  }
  const averageRpe = rpes.length ? Math.round((rpes.reduce((sum, value) => sum + value, 0) / rpes.length) * 10) / 10 : null;
  const warnings = [
    ...(!sessions.length ? ["Chưa có buổi tập trong giai đoạn này."] : []),
    ...(measurements.length < 2 ? ["Chưa có đủ hai lần đo để so sánh chỉ số cơ thể."] : []),
  ];
  const sentences: string[] = [];
  if (total) sentences.push(`Trong giai đoạn ${periodStart} – ${periodEnd}, học viên hoàn thành ${present + late}/${total} buổi${rate != null ? `, tỷ lệ tham gia ${rate}%` : ""}.`);
  const change = (label: string, key: string, unit: string) => typeof bodyDeltas[key] === "number" ? `${label} ${bodyDeltas[key] < 0 ? "giảm" : bodyDeltas[key] > 0 ? "tăng" : "không đổi"} ${Math.abs(bodyDeltas[key])}${unit}` : "";
  const body = [["cân nặng", "weight", " kg"], ["tỷ lệ mỡ", "bodyFatPercentage", "%"], ["khối lượng mỡ", "bodyFatMass", " kg"], ["khối lượng cơ", "muscleMass", " kg"], ["mỡ nội tạng", "visceralFatLevel", " cấp"], ["điểm InBody", "inbodyScore", " điểm"], ["vòng eo", "waist", " cm"]].map(([label, key, unit]) => change(label, key, unit)).filter(Boolean);
  if (body.length) sentences.push(`Chỉ số cơ thể: ${body.join(", ")}.`);
  if (totalVolume > 0) sentences.push(`Tổng khối lượng tập ${Math.round(totalVolume * 10) / 10} kg${averageRpe != null ? `, RPE trung bình ${averageRpe}` : ""}.`);
  if (!sentences.length) sentences.push("Chưa có đủ dữ liệu để đánh giá tiến bộ trong giai đoạn này.");
  return saveRecord(actor, "progress-reports", {
    customerId, periodStart, periodEnd, summary: sentences.join(" "),
    metrics: { totalVolume, averageRpe, attendanceRate: rate, weightDelta: bodyDeltas.weight, bodyFatDelta: bodyDeltas.bodyFatPercentage, muscleDelta: bodyDeltas.muscleMass },
    warnings, sourceVersions: { sessions: allSessions.length, measurements: allMeasurements.length }, generatorVersion: 1,
  });
}
export async function publishProgressReport(actor: GymActor, id: string, revision: number, publish: boolean) {
  const report = await getRecord(actor, "progress-reports", id);
  const now = new Date().toISOString();
  const result = await records("progress-reports").findOneAndUpdate(
    { ...tenantFilter(actor), _id: report._id, revision },
    { $set: { status: publish ? "PUBLISHED" : "DRAFT", publishedAt: publish ? now : null, updatedAt: now }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!result) throw new ConflictError("CONFLICT", "Báo cáo đã thay đổi. Vui lòng tải lại.");
  return publicRecord(result);
}

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateKey(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (ISO_DAY_RE.test(raw.slice(0, 10))) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function inDateRange(value: unknown, from: string, to: string): boolean {
  const key = toDateKey(value);
  return key != null && key >= from && key <= to;
}

function defaultPeriodRange() {
  const today = new Date().toISOString().slice(0, 10);
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

function buildActivityTrend(
  from: string,
  to: string,
  sessions: GymRecord[],
  measurements: GymRecord[],
  customers: GymRecord[],
) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const bucketKeyOf = (dateKey: string) => {
    const bucket = new Date(`${dateKey}T00:00:00Z`);
    if (days > 180) bucket.setUTCDate(1);
    else if (days > 45) bucket.setUTCDate(bucket.getUTCDate() - ((bucket.getUTCDay() + 6) % 7));
    return bucket.toISOString().slice(0, 10);
  };

  const buckets = new Map<
    string,
    { date: string; sessions: number; measurements: number; newCustomers: number }
  >();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start.getTime() + offset * 86_400_000);
    const key = bucketKeyOf(date.toISOString().slice(0, 10));
    if (!buckets.has(key)) {
      buckets.set(key, { date: key, sessions: 0, measurements: 0, newCustomers: 0 });
    }
  }

  for (const s of sessions) {
    const day = toDateKey(s.performedAt || s.createdAt);
    if (!day || day < from || day > to) continue;
    const entry = buckets.get(bucketKeyOf(day));
    if (entry) entry.sessions += 1;
  }
  for (const m of measurements) {
    const day = toDateKey(m.measurementDate || m.createdAt);
    if (!day || day < from || day > to) continue;
    const entry = buckets.get(bucketKeyOf(day));
    if (entry) entry.measurements += 1;
  }
  for (const c of customers) {
    const day = toDateKey(c.createdAt);
    if (!day || day < from || day > to) continue;
    const entry = buckets.get(bucketKeyOf(day));
    if (entry) entry.newCustomers += 1;
  }

  return [...buckets.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      ...row,
      label:
        days > 180
          ? `${row.date.slice(5, 7)}/${row.date.slice(0, 4)}`
          : `${row.date.slice(8, 10)}/${row.date.slice(5, 7)}`,
    }));
}

export async function dashboard(
  actor: GymActor,
  query: Record<string, unknown> = {},
) {
  const fallback = defaultPeriodRange();
  const rawFrom = typeof query.from === "string" && ISO_DAY_RE.test(query.from) ? query.from : fallback.from;
  const rawTo = typeof query.to === "string" && ISO_DAY_RE.test(query.to) ? query.to : fallback.to;
  const from = rawFrom <= rawTo ? rawFrom : fallback.from;
  const to = rawFrom <= rawTo ? rawTo : fallback.to;
  const previousFrom =
    typeof query.previousFrom === "string" && ISO_DAY_RE.test(query.previousFrom)
      ? query.previousFrom
      : "";
  const previousTo =
    typeof query.previousTo === "string" && ISO_DAY_RE.test(query.previousTo)
      ? query.previousTo
      : "";
  const hasPrevious = Boolean(previousFrom && previousTo && previousFrom <= previousTo);

  const customers = await records("customers")
    .find(customerFilter(actor))
    .toArray();
  const ids = customers.map((c) => c._id);
  const scope = { ...tenantFilter(actor), customerId: { $in: ids } };
  const isAdmin = gymAdmin(actor.role);

  const [
    sessionDocs,
    measurements,
    workoutPlans,
    nutritionPlans,
    roadmaps,
    goals,
    packages,
    progressReports,
    transferDocs,
    trainerUsers,
  ] = await Promise.all([
    records("sessions")
      .find(scope, { projection: { customerId: 1, performedAt: 1, attendance: 1, createdAt: 1 } })
      .toArray(),
    records("measurements").find(scope).sort({ measurementDate: 1 }).toArray(),
    records("workout-plans")
      .find(scope, { projection: { customerId: 1, status: 1, publicationStatus: 1, createdAt: 1 } })
      .toArray(),
    records("nutrition-plans")
      .find(scope, { projection: { customerId: 1, status: 1, createdAt: 1 } })
      .toArray(),
    records("roadmaps")
      .find(scope, { projection: { customerId: 1, status: 1, createdAt: 1 } })
      .toArray(),
    records("goals")
      .find(scope, { projection: { customerId: 1, type: 1, status: 1, createdAt: 1 } })
      .toArray(),
    records("packages")
      .find(scope, { projection: { customerId: 1, status: 1, totalSessions: 1, startDate: 1, endDate: 1, createdAt: 1 } })
      .toArray(),
    records("progress-reports")
      .find(scope, { projection: { customerId: 1, status: 1, createdAt: 1 } })
      .toArray(),
    isAdmin
      ? records("transfers")
          .find(tenantFilter(actor), { projection: { status: 1, createdAt: 1 } })
          .toArray()
      : Promise.resolve([]),
    isAdmin
      ? UserModel.find({
          companyCode: actor.companyCode,
          $or: [
            { branchId: actor.branchId },
            { branchId: { $in: [null, ""] } },
            { branchId: { $exists: false } },
          ],
          role: "pt",
          disabledAt: null,
        })
          .select("displayName")
          .lean()
      : Promise.resolve([]),
  ]);

  const sessions = sessionDocs.length;
  const plans = workoutPlans.length;

  const customerRows = customers.map((c) => {
    const rows = measurements
      .filter((m) => m.customerId === c._id)
      .sort((a, b) => String(a.measurementDate || "").localeCompare(String(b.measurementDate || "")));
    const sufficient = rows.length >= 2;
    const first = rows[0] ? publicRecord(rows[0]) : null;
    const latest = rows.length ? publicRecord(rows[rows.length - 1]) : null;

    if (!sufficient || !first || !latest) {
      return {
        customerId: c._id,
        fullName: c.fullName,
        phone: c.phone || "",
        status: c.status || "ACTIVE",
        initialGoal: c.initialGoal || "Cải thiện vóc dáng & sức khỏe",
        initialWeight: c.initialWeight ?? first?.weight ?? null,
        dataStatus: "INSUFFICIENT_DATA" as const,
        score: null as number | null,
        scoreBreakdown: null as { measurementTrend: number; careRisk: number } | null,
        progressCategory: "INSUFFICIENT_DATA" as const,
        measurementCount: rows.length,
        firstMeasurement: first,
        latestMeasurement: latest,
        changes: null,
        openAlerts: 0,
        riskFactors: ["Chưa đo đủ ≥ 2 lần InBody để so sánh trước/sau (BF-AT)"],
        improvementTips: [
          "Hẹn học viên lịch đo InBody lần tiếp theo để hoàn thiện dữ liệu tiến độ.",
          "Kiểm tra lại tần suất tập luyện và mức độ tham gia các buổi tập trong tuần.",
        ],
      };
    }

    const bodyFatChange = Number(first.bodyFatPercentage ?? 0) - Number(latest.bodyFatPercentage ?? 0);
    const muscleChange = Number(latest.muscleMass ?? 0) - Number(first.muscleMass ?? 0);
    const weightChange = Number(latest.weight ?? 0) - Number(first.weight ?? 0);
    const measurementTrend = Math.max(
      0,
      Math.min(70, Math.round(50 + bodyFatChange * 5 + muscleChange * 5)),
    );
    const openAlerts = bodyFatChange < -1 || muscleChange < -1 ? 1 : 0;
    const careRisk = Math.max(0, 30 - openAlerts * 10);
    const score = measurementTrend + careRisk;

    let progressCategory: "GOOD" | "SLOW" | "POOR" = "SLOW";
    if (score >= 70) progressCategory = "GOOD";
    else if (score < 50) progressCategory = "POOR";

    const riskFactors: string[] = [];
    const improvementTips: string[] = [];
    if (bodyFatChange < 0) {
      riskFactors.push(`Tỷ lệ mỡ tăng (+${Math.abs(bodyFatChange).toFixed(1)}% so với lần đo đầu)`);
      improvementTips.push("Kiểm soát lại lượng Calorie nạp vào, hạn chế đường tinh luyện & đồ ăn khuya.");
    }
    if (muscleChange < 0) {
      riskFactors.push(`Khối lượng cơ bắp suy giảm (${muscleChange.toFixed(1)} kg)`);
      improvementTips.push("Tăng cường nạp đạm (Protein), tối ưu thời gian ngủ nghỉ (≥ 7h) để phục hồi sợi cơ.");
    }
    if (bodyFatChange === 0 && muscleChange === 0) {
      riskFactors.push("Chỉ số cơ/mỡ chưa có biến chuyển sau các lần đo");
      improvementTips.push("Xem xét điều chỉnh tăng tiến mức tạ (Progressive Overload) hoặc thay đổi bài tập Cardio.");
    }
    if (improvementTips.length === 0) {
      improvementTips.push("Duy trì phác đồ tập luyện và chế độ ăn hiện tại, tiếp tục phát huy kết quả tốt.");
    }

    const daysBetween = Math.max(
      1,
      Math.round(
        (new Date(String(latest.measurementDate)).getTime() -
          new Date(String(first.measurementDate)).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );

    return {
      customerId: c._id,
      fullName: c.fullName,
      phone: c.phone || "",
      status: c.status || "ACTIVE",
      initialGoal: c.initialGoal || "Tăng cơ giảm mỡ & săn chắc vóc dáng",
      initialWeight: c.initialWeight ?? first.weight ?? null,
      dataStatus: "READY" as const,
      score,
      scoreBreakdown: { measurementTrend, careRisk },
      progressCategory,
      measurementCount: rows.length,
      firstMeasurement: first,
      latestMeasurement: latest,
      changes: {
        bodyFatChange: Number(bodyFatChange.toFixed(1)),
        muscleChange: Number(muscleChange.toFixed(1)),
        weightChange: Number(weightChange.toFixed(1)),
        daysBetween,
      },
      openAlerts,
      riskFactors,
      improvementTips,
    };
  });

  const readyCustomers = customerRows.filter((c) => c.dataStatus === "READY");
  const goodProgressCount = readyCustomers.filter((c) => (c.score ?? 0) >= 70).length;
  const slowProgressCount = readyCustomers.filter((c) => (c.score ?? 0) >= 50 && (c.score ?? 0) < 70).length;
  const poorProgressCount = readyCustomers.filter((c) => (c.score ?? 0) < 50).length;
  const insufficientDataCount = customerRows.filter((c) => c.dataStatus === "INSUFFICIENT_DATA").length;

  const periodSessions = sessionDocs.filter((s) => inDateRange(s.performedAt || s.createdAt, from, to));
  const previousSessions = hasPrevious
    ? sessionDocs.filter((s) => inDateRange(s.performedAt || s.createdAt, previousFrom, previousTo)).length
    : null;
  const periodMeasurements = measurements.filter((m) => inDateRange(m.measurementDate || m.createdAt, from, to));
  const previousMeasurements = hasPrevious
    ? measurements.filter((m) => inDateRange(m.measurementDate || m.createdAt, previousFrom, previousTo)).length
    : null;
  const periodNewCustomers = customers.filter((c) => inDateRange(c.createdAt, from, to)).length;
  const previousNewCustomers = hasPrevious
    ? customers.filter((c) => inDateRange(c.createdAt, previousFrom, previousTo)).length
    : null;

  const attendanceCounts = { PRESENT: 0, LATE: 0, ABSENT: 0 };
  for (const s of periodSessions) {
    if (s.attendance === "PRESENT" || s.attendance === "LATE" || s.attendance === "ABSENT") {
      attendanceCounts[s.attendance as keyof typeof attendanceCounts] += 1;
    }
  }
  const attendanceTotal = attendanceCounts.PRESENT + attendanceCounts.LATE + attendanceCounts.ABSENT;
  const attendanceRate = attendanceTotal
    ? Math.round(((attendanceCounts.PRESENT + attendanceCounts.LATE) / attendanceTotal) * 1000) / 10
    : null;

  const averageScore = readyCustomers.length
    ? Math.round((readyCustomers.reduce((sum, c) => sum + (c.score ?? 0), 0) / readyCustomers.length) * 10) / 10
    : null;
  const averageBodyFatDelta = readyCustomers.length
    ? Math.round((readyCustomers.reduce((sum, c) => sum + (c.changes?.bodyFatChange ?? 0), 0) / readyCustomers.length) * 10) / 10
    : null;
  const averageMuscleDelta = readyCustomers.length
    ? Math.round((readyCustomers.reduce((sum, c) => sum + (c.changes?.muscleChange ?? 0), 0) / readyCustomers.length) * 10) / 10
    : null;

  const customerStatusCounts = { ACTIVE: 0, LEAD: 0, INACTIVE: 0 };
  const genderCounts = { MALE: 0, FEMALE: 0, OTHER: 0 };
  for (const c of customers) {
    const st = String(c.status || "ACTIVE").toUpperCase();
    if (st === "ACTIVE" || st === "LEAD" || st === "INACTIVE") customerStatusCounts[st] += 1;
    const g = String(c.gender || "OTHER").toUpperCase();
    if (g === "MALE" || g === "FEMALE" || g === "OTHER") genderCounts[g] += 1;
  }

  const goalTypeCounts: Record<string, number> = {
    WEIGHT_LOSS: 0,
    FAT_LOSS: 0,
    MUSCLE_GAIN: 0,
    RECOMPOSITION: 0,
    WEIGHT_GAIN: 0,
    FITNESS: 0,
  };
  for (const g of goals) {
    const t = String(g.type || "").toUpperCase();
    if (t in goalTypeCounts) goalTypeCounts[t] += 1;
  }

  const packageStatusCounts = { ACTIVE: 0, COMPLETED: 0, EXPIRED: 0, CANCELLED: 0 };
  const todayKey = new Date().toISOString().slice(0, 10);
  const in14Days = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  let expiringPackages = 0;
  for (const pkg of packages) {
    const st = String(pkg.status || "ACTIVE").toUpperCase();
    if (st in packageStatusCounts) packageStatusCounts[st as keyof typeof packageStatusCounts] += 1;
    const endKey = toDateKey(pkg.endDate);
    if (st === "ACTIVE" && endKey && endKey >= todayKey && endKey <= in14Days) {
      expiringPackages += 1;
    }
  }

  const planCoverage = [
    {
      key: "workoutPlans",
      name: "Giáo án tập",
      published: workoutPlans.filter((p) => p.publicationStatus === "PUBLISHED").length,
      draft: workoutPlans.filter((p) => p.publicationStatus !== "PUBLISHED").length,
    },
    {
      key: "nutritionPlans",
      name: "Thực đơn",
      published: nutritionPlans.filter((p) => p.status === "PUBLISHED").length,
      draft: nutritionPlans.filter((p) => p.status !== "PUBLISHED").length,
    },
    {
      key: "roadmaps",
      name: "Lộ trình",
      published: roadmaps.filter((p) => p.status === "PUBLISHED").length,
      draft: roadmaps.filter((p) => p.status !== "PUBLISHED").length,
    },
    {
      key: "progressReports",
      name: "Báo cáo tiến độ",
      published: progressReports.filter((p) => p.status === "PUBLISHED").length,
      draft: progressReports.filter((p) => p.status !== "PUBLISHED").length,
    },
  ];

  const trainerNameMap = new Map<string, string>(
    trainerUsers.map((u) => [String(u._id), String(u.displayName || "PT")]),
  );
  const customerPtMap = new Map<string, string>(
    customers.map((c) => [c._id, String(c.assignedPtId || "")]),
  );
  const trainerStats = new Map<string, { id: string; name: string; customers: number; sessions: number }>();
  if (isAdmin) {
    for (const u of trainerUsers) {
      const uid = String(u._id);
      trainerStats.set(uid, { id: uid, name: String(u.displayName || "PT"), customers: 0, sessions: 0 });
    }
    for (const c of customers) {
      const ptId = String(c.assignedPtId || "");
      if (!ptId) continue;
      const entry = trainerStats.get(ptId) ?? {
        id: ptId,
        name: trainerNameMap.get(ptId) || "PT khác",
        customers: 0,
        sessions: 0,
      };
      entry.customers += 1;
      trainerStats.set(ptId, entry);
    }
    for (const s of periodSessions) {
      const ptId = customerPtMap.get(String(s.customerId || "")) || "";
      if (!ptId) continue;
      const entry = trainerStats.get(ptId);
      if (entry) entry.sessions += 1;
    }
  }
  const trainerWorkload = [...trainerStats.values()]
    .filter((row) => row.customers > 0 || row.sessions > 0)
    .sort((a, b) => b.customers - a.customers || b.sessions - a.sessions)
    .slice(0, 8);

  const pendingTransfers = transferDocs.filter((t) => t.status === "PENDING").length;

  return {
    customers: customers.length,
    totalCustomers: customers.length,
    activeCustomers: customerStatusCounts.ACTIVE,
    sessions,
    plans,
    openAlerts: customerRows.reduce((sum, c) => sum + c.openAlerts, 0),
    goodProgressCount,
    slowProgressCount,
    poorProgressCount,
    insufficientDataCount,
    customerRows,
    progress: customerRows.map((c) => ({
      customerId: c.customerId,
      fullName: c.fullName,
      measurementCount: c.measurementCount,
      first: c.firstMeasurement,
      latest: c.latestMeasurement,
    })),
    canAdmin: isAdmin,
    analytics: {
      period: { from, to, previousFrom: hasPrevious ? previousFrom : null, previousTo: hasPrevious ? previousTo : null },
      periodMetrics: {
        newCustomers: { current: periodNewCustomers, previous: previousNewCustomers },
        sessions: { current: periodSessions.length, previous: previousSessions },
        measurements: { current: periodMeasurements.length, previous: previousMeasurements },
      },
      summary: {
        attendanceRate,
        averageScore,
        averageBodyFatDelta,
        averageMuscleDelta,
        activePackages: packageStatusCounts.ACTIVE,
        expiringPackages,
        totalMeasurements: measurements.length,
        totalGoals: goals.length,
        totalPackages: packages.length,
        pendingTransfers,
      },
      activityTrend: buildActivityTrend(from, to, sessionDocs, measurements, customers),
      customerStatus: customerStatusCounts,
      gender: genderCounts,
      attendance: attendanceCounts,
      goalTypes: goalTypeCounts,
      packageStatus: packageStatusCounts,
      planCoverage,
      trainerWorkload,
    },
  };
}
