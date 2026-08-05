import { WorkerStandardFieldModel } from "../models/worker-standard-field.model";
import type { WorkerScope } from "../contracts";
const scoped = (scope: WorkerScope) => ({ companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}) });
export async function getWorkerStandardFields(scope: WorkerScope, moduleKey: string) { const item = await (WorkerStandardFieldModel as any).findOne({ ...scoped(scope), moduleKey }).lean(); return item?.fields || []; }
export async function setWorkerStandardFields(scope: WorkerScope, moduleKey: string, fields: unknown[]) { return (WorkerStandardFieldModel as any).findOneAndUpdate({ ...scoped(scope), moduleKey }, { ...scoped(scope), moduleKey, fields }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean(); }
