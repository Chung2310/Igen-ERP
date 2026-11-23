import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { ConflictError, NotFoundError, ValidationError } from "../../errors/app-error";
import { tenantFilter, type GymActor } from "./access";
import { records } from "./store";
import type { GymRecord } from "../../../shared/gym/types";

const defaults = [
  "Ngực", "Lưng", "Vai", "Tay trước", "Tay sau", "Chân", "Mông",
  "Bụng / Core", "Toàn thân", "Tim mạch / Cardio",
];

type MuscleGroup = { _id: string; name: string; normalizedName: string; isDefault: false; companyCode: string; branchId: string };
const keyOf = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
const namesOf = (exercise: GymRecord) => {
  const values = Array.isArray(exercise.muscleGroups) && exercise.muscleGroups.length
    ? exercise.muscleGroups
    : typeof exercise.muscleGroup === "string" ? exercise.muscleGroup.split(",") : [];
  return new Set(values.filter((name): name is string => typeof name === "string").map(name => name.trim()).filter(Boolean));
};
function collection() {
  if (!mongoose.connection.db) throw new Error("Database chưa sẵn sàng.");
  return mongoose.connection.db.collection<MuscleGroup>("gym_muscle_groups");
}

export async function listMuscleGroups(actor: GymActor) {
  const scope = tenantFilter(actor);
  const [saved, exercises] = await Promise.all([
    collection().find(scope).toArray(),
    records("exercises").find(scope, { projection: { muscleGroup: 1, muscleGroups: 1 } }).toArray(),
  ]);
  const groups = new Map<string, { _id: string; name: string; isDefault: boolean; exerciseCount: number }>();
  for (const name of defaults) groups.set(keyOf(name), { _id: `default:${keyOf(name)}`, name, isDefault: true, exerciseCount: 0 });
  for (const group of saved) {
    const key = keyOf(group.name);
    if (!groups.has(key)) groups.set(key, { _id: group._id, name: group.name, isDefault: false, exerciseCount: 0 });
  }
  for (const exercise of exercises) {
    const seen = new Set<string>();
    for (const name of namesOf(exercise)) {
      const key = keyOf(name);
      if (seen.has(key)) continue;
      seen.add(key);
      const group = groups.get(key) || { _id: `exercise:${key}`, name, isDefault: false, exerciseCount: 0 };
      group.exerciseCount += 1;
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));
}

export async function createMuscleGroup(actor: GymActor, rawName: unknown) {
  if (typeof rawName !== "string") throw new ValidationError("VALIDATION_FAILED", "Tên nhóm cơ không hợp lệ.");
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name || name.length > 100) throw new ValidationError("VALIDATION_FAILED", "Tên nhóm cơ phải có từ 1 đến 100 ký tự.");
  const normalizedName = keyOf(name);
  if ((await listMuscleGroups(actor)).some(group => keyOf(group.name) === normalizedName))
    throw new ConflictError("CONFLICT", `Nhóm cơ "${name}" đã tồn tại.`);
  const scope = tenantFilter(actor);
  await collection().createIndex({ companyCode: 1, branchId: 1, normalizedName: 1 }, { unique: true });
  const group: MuscleGroup = { _id: new ObjectId().toHexString(), name, normalizedName, isDefault: false, ...scope };
  try {
    await collection().insertOne(group);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000)
      throw new ConflictError("CONFLICT", `Nhóm cơ "${name}" đã tồn tại.`);
    throw error;
  }
  return { _id: group._id, name, isDefault: false, exerciseCount: 0 };
}

export async function deleteMuscleGroup(actor: GymActor, id: string) {
  const scope = tenantFilter(actor);
  const group = await collection().findOne({ _id: id, ...scope });
  if (!group) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy nhóm cơ.");
  const current = (await listMuscleGroups(actor)).find(item => item._id === id);
  if (current?.exerciseCount) throw new ConflictError("CONFLICT", `Không thể xóa "${group.name}" vì đang có bài tập sử dụng.`);
  await collection().deleteOne({ _id: id, ...scope });
  return { message: "Đã xóa nhóm cơ." };
}
