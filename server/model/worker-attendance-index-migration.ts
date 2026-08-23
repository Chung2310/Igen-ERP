import { WorkerAttendanceLogModel } from "../modules/worker-management/models/worker-attendance-log.model";

type MongoIndex = { name?: string; key: Record<string, number>; unique?: boolean };
export type WorkerAttendanceIndexCollection = { indexes(): Promise<MongoIndex[]>; dropIndex(name: string): Promise<unknown> };

/**
 * Trước khi tách học viên và người lao động, bảng chấm công dùng khóa
 * studentId/batchId. Bản ghi mới không còn hai trường này nên chúng đều là null:
 * chỉ lao động đầu tiên chấm được, những người sau đụng unique index và nhận
 * lỗi "Dữ liệu đã tồn tại".
 */
const legacyFields = ["studentId", "batchId"];

function isLegacy(index: MongoIndex): boolean {
  return Object.keys(index.key || {}).some((field) => legacyFields.includes(field));
}

export async function dropLegacyWorkerAttendanceIndexes(collection: WorkerAttendanceIndexCollection): Promise<number> {
  let indexes: MongoIndex[];
  try { indexes = await collection.indexes(); } catch (error: any) {
    if (error?.codeName === "NamespaceNotFound" || error?.code === 26) return 0;
    throw error;
  }
  let dropped = 0;
  for (const index of indexes.filter(isLegacy)) {
    if (!index.name) continue;
    try { await collection.dropIndex(index.name); dropped += 1; } catch (error: any) {
      if (error?.codeName !== "IndexNotFound" && error?.code !== 27) throw error;
    }
  }
  return dropped;
}

export async function dropLegacyWorkerAttendanceLogIndexes(): Promise<number> {
  return dropLegacyWorkerAttendanceIndexes(WorkerAttendanceLogModel.collection as unknown as WorkerAttendanceIndexCollection);
}
