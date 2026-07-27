import { superAdminRequest } from "./superAdminRequest";

export interface SuperAdminAccount {
  _id: string; email: string; displayName: string; createdAt: string; isActive: boolean;
  superAdminSecurity?: { totpEnabled?: boolean };
}

export const superAdminAccountService = {
  async list(): Promise<SuperAdminAccount[]> {
    const result = await superAdminRequest("/api/v1/super-admin/admins") as { admins: SuperAdminAccount[] };
    return result.admins;
  },
  async create(input: { displayName: string; email: string; password: string }): Promise<SuperAdminAccount> {
    const result = await superAdminRequest("/api/v1/super-admin/admins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }) as { admin: SuperAdminAccount };
    return result.admin;
  },
};
