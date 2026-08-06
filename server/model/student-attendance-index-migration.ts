import { StudentVerificationCodeModel } from "../modules/student-management/models/student-verification-code.model";

type MongoIndex = { name?: string; key: Record<string, number>; unique?: boolean };
export type StudentVerificationIndexCollection = { indexes(): Promise<MongoIndex[]>; dropIndex(name: string): Promise<unknown> };

const legacyKey = { studentId: 1, batchId: 1, date: 1 };

export async function dropLegacyStudentAttendanceUniqueIndex(collection: StudentVerificationIndexCollection = StudentVerificationCodeModel.collection as unknown as StudentVerificationIndexCollection): Promise<boolean> {
  let indexes: MongoIndex[];
  try { indexes = await collection.indexes(); } catch (error: any) {
    if (error?.codeName === "NamespaceNotFound" || error?.code === 26) return false;
    throw error;
  }
  const legacy = indexes.find((index) => index.unique === true && JSON.stringify(index.key) === JSON.stringify(legacyKey));
  if (!legacy?.name) return false;
  try { await collection.dropIndex(legacy.name); return true; } catch (error: any) {
    if (error?.codeName === "IndexNotFound" || error?.code === 27) return false;
    throw error;
  }
}
