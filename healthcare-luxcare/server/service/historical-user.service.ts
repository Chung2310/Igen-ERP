import type { ClientSession } from "mongoose";
import { HistoricalUserModel } from "../model/historical-user.model";
import { UserModel } from "../model/user.model";

// Look up historical references independently of active-user dropdowns.
// An inactive account still exists and must not be labelled as deleted.
export async function deletedHistoricalUserIds(companyCode: string, references: unknown[]) {
  const ids = [
    ...new Set(references.filter((id): id is string => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id))),
  ];
  if (!ids.length) return new Set<string>();
  const users = await UserModel.find({ companyCode, _id: { $in: ids } })
    .select("_id isDeleted")
    .lean();
  const existing = new Set(users.filter((user: any) => user.isDeleted !== true).map((user: any) => String(user._id)));
  return new Set(ids.filter((id) => !existing.has(id)));
}

export async function annotateHistoricalTasks(tasks: any[]) {
  const companies = [...new Set(tasks.map((task) => String(task.companyCode)))];
  const deletedByCompany = new Map(
    await Promise.all(
      companies.map(async (company) => {
        const references = tasks
          .filter((task) => String(task.companyCode) === company)
          .flatMap((task) => [task.assigneeUid, ...(task.subtasks || []).map((sub: any) => sub.assigneeUid)]);
        return [company, await deletedHistoricalUserIds(company, references)] as const;
      }),
    ),
  );
  return tasks.map((task) => {
    const deleted = deletedByCompany.get(String(task.companyCode))!;
    return {
      ...task,
      assigneeDeleted: deleted.has(task.assigneeUid),
      subtasks: (task.subtasks || []).map((sub: any) => ({ ...sub, assigneeDeleted: deleted.has(sub.assigneeUid) })),
    };
  });
}

export async function annotateHistoricalRecords<T extends Record<string, any>>(
  companyCode: string,
  rows: T[],
  idKey = "employeeId",
  nameKey = "employeeName",
  deletedKey = "employeeDeleted",
): Promise<(T & Record<string, any>)[]> {
  const ids = [...new Set(rows.map((row) => String(row[idKey] || "")).filter((id) => /^[a-f0-9]{24}$/i.test(id)))];
  if (!ids.length) return rows;
  const [users, archived] = await Promise.all([
    UserModel.find({ companyCode, _id: { $in: ids } })
      .select("_id displayName isDeleted")
      .lean(),
    HistoricalUserModel.find({ companyCode, userId: { $in: ids } })
      .select("userId displayName")
      .lean(),
  ]);
  const current = new Map(users.map((u: any) => [String(u._id), u]));
  const old = new Map(archived.map((u: any) => [u.userId, u]));
  return rows.map((row) => {
    const id = String(row[idKey] || "");
    if (!ids.includes(id)) return row;
    const user = current.get(id) as any;
    const deleted = !user || user.isDeleted === true;
    return {
      ...row,
      [nameKey]:
        row[nameKey] ||
        user?.displayName ||
        (old.get(id) as any)?.displayName ||
        (deleted ? "Tài khoản đã xóa" : "Người dùng"),
      [deletedKey]: deleted,
    };
  });
}

export async function archiveHistoricalUser(user: {
  _id: unknown;
  companyCode?: string;
  displayName?: string;
  branchId?: string;
  parentId?: unknown;
  role?: string;
}, options: { session?: ClientSession } = {}) {
  await HistoricalUserModel.updateOne(
    { companyCode: user.companyCode || "SYSTEM", userId: String(user._id) },
    {
      $set: {
        displayName: user.displayName || "",
        branchId: user.branchId || "",
        parentId: String(user.parentId || ""),
        role: user.role,
        deletedAt: new Date(),
      },
    },
    { upsert: true, ...options },
  );
}
