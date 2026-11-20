import { getCredentialStatus, type HRCredentialStatus, type HRCredentialType } from "../../shared/hr-credential";
import { deletedHistoricalUserIds } from "./historical-user.service";
import { HRCredentialModel } from "../model/hr-credential.model";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function syncCredentialStatuses(scope: Record<string, unknown>, now = new Date()) {
  const credentials = await HRCredentialModel.find(scope).select("_id expiryDate reminderDays status").lean();
  const updates = credentials.flatMap((item: any) => {
    const status = getCredentialStatus(item.expiryDate, item.reminderDays, now);
    return status === item.status ? [] : [{ updateOne: { filter: { _id: item._id }, update: { $set: { status } } } }];
  });
  if (updates.length) await HRCredentialModel.bulkWrite(updates as any);
  return updates.length;
}

export const hrCredentialService = {
  async list(params: {
    companyCode: string;
    branchId?: string;
    employeeId?: string;
    status?: HRCredentialStatus;
    type?: HRCredentialType;
    search?: string;
    page: number;
    limit: number;
    all?: boolean;
  }) {
    const scope: Record<string, unknown> = { companyCode: params.companyCode };
    if (params.branchId) scope.branchId = params.branchId;
    if (params.employeeId) scope.employeeId = params.employeeId;
    await syncCredentialStatuses(scope);

    const query: Record<string, unknown> = { ...scope };
    if (params.status) query.status = params.status;
    if (params.type) query.type = params.type;
    const search = params.search?.trim();
    if (search) {
      const pattern = escapeRegex(search);
      query.$or = [
        { employeeName: { $regex: pattern, $options: "i" } },
        { name: { $regex: pattern, $options: "i" } },
        { credentialNumber: { $regex: pattern, $options: "i" } },
        { issuingOrganization: { $regex: pattern, $options: "i" } },
        { professionalScope: { $regex: pattern, $options: "i" } },
      ];
    }

    const credentialsQuery = HRCredentialModel.find(query).sort({ status: -1, expiryDate: 1, updatedAt: -1 });
    if (!params.all) {
      credentialsQuery.skip((params.page - 1) * params.limit).limit(params.limit);
    }

    const [credentials, total, active, expiring, expired] = await Promise.all([
      credentialsQuery.lean(),
      HRCredentialModel.countDocuments(query),
      HRCredentialModel.countDocuments({ ...scope, status: "active" }),
      HRCredentialModel.countDocuments({ ...scope, status: "expiring" }),
      HRCredentialModel.countDocuments({ ...scope, status: "expired" }),
    ]);
    const deleted = await deletedHistoricalUserIds(params.companyCode, credentials.map((item: any) => item.employeeId));
    return {
      credentials: credentials.map((item: any) => ({ ...item, employeeDeleted: deleted.has(String(item.employeeId)) })),
      total,
      page: params.page,
      limit: params.limit,
      summary: { total: active + expiring + expired, active, expiring, expired },
    };
  },
};
