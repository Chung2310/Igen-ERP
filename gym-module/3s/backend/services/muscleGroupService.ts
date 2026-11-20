import MuscleGroup from '../models/MuscleGroup.js';
import Exercise from '../models/Exercise.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

export const DEFAULT_MUSCLE_GROUPS = [
  'Ngực',
  'Lưng',
  'Vai',
  'Tay trước',
  'Tay sau',
  'Chân',
  'Mông',
  'Bụng / Core',
  'Toàn thân',
  'Tim mạch / Cardio',
];

export async function ensureDefaultMuscleGroups(): Promise<void> {
  const existing = await MuscleGroup.find().select('name').lean();
  const existingNamesLower = new Set(existing.map((g) => g.name.trim().toLocaleLowerCase('vi')));

  const toInsert: Array<{ name: string; isDefault: boolean; order: number }> = [];

  // 1. Add default groups if missing
  DEFAULT_MUSCLE_GROUPS.forEach((name, index) => {
    const key = name.trim().toLocaleLowerCase('vi');
    if (!existingNamesLower.has(key)) {
      toInsert.push({ name: name.trim(), isDefault: true, order: index });
      existingNamesLower.add(key);
    }
  });

  // 2. Add existing exercise muscle groups if missing
  try {
    const exerciseGroups = await Exercise.distinct('muscleGroup');
    exerciseGroups.forEach((val) => {
      if (typeof val === 'string' && val.trim()) {
        val.split(',').forEach((name) => {
          const trimmed = name.trim();
          const key = trimmed.toLocaleLowerCase('vi');
          if (key && !existingNamesLower.has(key)) {
            toInsert.push({ name: trimmed, isDefault: false, order: 100 });
            existingNamesLower.add(key);
          }
        });
      }
    });
  } catch {
    // If exercise collection is not ready yet, continue
  }

  if (toInsert.length > 0) {
    await MuscleGroup.insertMany(toInsert, { ordered: false }).catch(() => {
      // Ignore duplicate key errors on concurrent inserts
    });
  }
}

export async function listMuscleGroups() {
  await ensureDefaultMuscleGroups();

  const [groups, allExercises] = await Promise.all([
    MuscleGroup.find().lean(),
    Exercise.find().select('muscleGroup muscleGroups').lean(),
  ]);

  const countMap = new Map<string, number>();
  for (const ex of allExercises) {
    const names = new Set<string>();
    if (Array.isArray(ex.muscleGroups) && ex.muscleGroups.length > 0) {
      ex.muscleGroups.forEach((g) => { if (g && typeof g === 'string') names.add(g.trim().toLocaleLowerCase('vi')); });
    } else if (typeof ex.muscleGroup === 'string') {
      ex.muscleGroup.split(',').forEach((g) => { if (g && g.trim()) names.add(g.trim().toLocaleLowerCase('vi')); });
    }
    for (const key of names) {
      if (key) countMap.set(key, (countMap.get(key) || 0) + 1);
    }
  }

  const result = groups.map((g) => ({
    _id: String(g._id),
    name: g.name,
    isDefault: Boolean(g.isDefault),
    exerciseCount: countMap.get(g.name.trim().toLocaleLowerCase('vi')) || 0,
  }));

  // Sắp xếp danh sách nhóm cơ theo bảng chữ cái tiếng Việt (A - Z)
  result.sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));

  return result;
}


export async function createMuscleGroup(rawName: string) {
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (!name) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Tên nhóm cơ không được để trống.' });
  }

  const existing = await MuscleGroup.findOne({
    name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  });

  if (existing) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: `Nhóm cơ "${name}" đã tồn tại.` });
  }

  const created = await MuscleGroup.create({
    name,
    isDefault: false,
    order: 50,
  });

  return {
    _id: String(created._id),
    name: created.name,
    isDefault: false,
    exerciseCount: 0,
  };
}

export async function deleteMuscleGroup(id: string) {
  const group = await MuscleGroup.findById(id);
  if (!group) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy nhóm cơ.' });
  }

  const inUse = await Exercise.exists({
    muscleGroup: { $regex: new RegExp(`^${group.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  });

  if (inUse) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      message: `Không thể xóa nhóm cơ "${group.name}" vì đang có bài tập sử dụng.`,
    });
  }

  await group.deleteOne();
  return { success: true };
}
