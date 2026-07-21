import { CompanyModel } from "../model/company.model";
import { UserModel } from "../model/user.model";
import { sanitizeModuleKeys, ModuleKey } from "../config/module-keys";
import { createCompanyAdminUser } from "../utils/company-admin-user";
export type TenantLifecycleStatus = "active" | "suspended" | "archived" | "scheduled-deletion";
export interface TenantRecord { code:string; name:string; ownerEmail:string; createdAt:Date; lifecycleStatus:TenantLifecycleStatus; lifecycleChangedAt?:Date; deletionScheduledAt?:Date|null; retentionEndsAt?:Date|null; deletionReason?:string; enabledModules?:ModuleKey[]; }
export interface TenantRepository { create(t:TenantRecord):Promise<TenantRecord>; list():Promise<TenantRecord[]>; get(c:string):Promise<TenantRecord|null>; update(c:string,u:Partial<TenantRecord>):Promise<TenantRecord|null>; }
const db: TenantRepository = { create: async t => (await CompanyModel.create(t)).toObject() as TenantRecord, list: async () => await CompanyModel.find({}).sort({createdAt:-1}).lean() as any, get: async c => await CompanyModel.findOne({code:c}).lean() as any, update: async(c,u) => await CompanyModel.findOneAndUpdate({code:c},{$set:u},{new:true,runValidators:true}).lean() as any };
const next:Record<TenantLifecycleStatus,TenantLifecycleStatus[]>={active:["suspended","archived"],suspended:["active","archived"],archived:["active"],"scheduled-deletion":[]};
const code=(v:string)=>{const c=String(v||"").trim().toUpperCase();if(!c)throw Error("Tenant code is required");return c}; const needed=(t:TenantRecord|null,c:string)=>{if(!t)throw Error(`Tenant ${c} not found`);return t};

export interface TenantCreateInput { code:string; name:string; ownerEmail:string; ownerName:string; ownerPassword:string; enabledModules?:unknown; }

export class TenantManagementService {
  constructor(private readonly tenants:TenantRepository=db) {}

  async create(v:TenantCreateInput){
    const c=code(v.code),name=String(v.name||"").trim(),ownerEmail=String(v.ownerEmail||"").trim().toLowerCase();
    const ownerName=String(v.ownerName||"").trim(), ownerPassword=String(v.ownerPassword||"");
    if(!name||!ownerEmail) throw Error("Tenant name and owner email are required");
    if(!ownerName) throw Error("Owner name is required");
    if(!ownerPassword || ownerPassword.length < 6) throw Error("Owner password must be at least 6 characters");
    if(await this.tenants.get(c)) throw Error(`Tenant ${c} already exists`);
    if(await UserModel.findOne({ email: ownerEmail })) throw Error(`Owner email "${ownerEmail}" is already in use`);

    const enabledModules = sanitizeModuleKeys(v.enabledModules);
    const now=new Date();
    const tenant = await this.tenants.create({code:c,name,ownerEmail,createdAt:now,lifecycleStatus:"active",lifecycleChangedAt:now,deletionScheduledAt:null,retentionEndsAt:null,deletionReason:"",enabledModules});
    const admin = await createCompanyAdminUser({ companyCode:c, companyName:name, ownerName, ownerEmail, ownerPassword });
    return { ...tenant, adminUserId: String(admin._id) };
  }

  list(){return this.tenants.list()}

  async get(v:string){const c=code(v);return needed(await this.tenants.get(c),c)}

  async update(v:string,input:Pick<Partial<TenantRecord>,"name"|"ownerEmail">){const u:Partial<TenantRecord>={};if(input.name!==undefined){if(!String(input.name).trim())throw Error("Tenant name is required");u.name=String(input.name).trim()}if(input.ownerEmail!==undefined){if(!String(input.ownerEmail).trim())throw Error("Owner email is required");u.ownerEmail=String(input.ownerEmail).trim()}if(!Object.keys(u).length)throw Error("No tenant fields to update");const c=code(v);return needed(await this.tenants.update(c,u),c)}

  async updateModules(v:string, enabledModulesInput:unknown){
    const c=code(v);
    await needed(await this.tenants.get(c),c);
    const enabledModules = sanitizeModuleKeys(enabledModulesInput);
    return needed(await this.tenants.update(c,{enabledModules}),c);
  }

  async transitionLifecycle(v:string,target:Exclude<TenantLifecycleStatus,"scheduled-deletion">){const c=code(v),t=needed(await this.tenants.get(c),c);if(!next[t.lifecycleStatus].includes(target))throw Error(`Invalid lifecycle transition from ${t.lifecycleStatus} to ${target}`);return needed(await this.tenants.update(c,{lifecycleStatus:target,lifecycleChangedAt:new Date()}),c)}

  async scheduleDeletion(v:string,reason:string,now=new Date(),impactPreview?:Record<string,unknown>,backupEvidenceId?:string){const c=code(v),t=needed(await this.tenants.get(c),c),r=String(reason||"").trim();if(t.lifecycleStatus!=="archived")throw Error("Tenant must be archived before deletion");if(!r)throw Error("Deletion reason is required");if(!impactPreview||!backupEvidenceId)throw Error("impact preview and backup evidence are required");const retentionEndsAt=new Date(now);retentionEndsAt.setUTCDate(retentionEndsAt.getUTCDate()+30);const deletionJob={status:"queued",impactPreview,backupEvidenceId};return needed(await this.tenants.update(c,{lifecycleStatus:"scheduled-deletion",lifecycleChangedAt:now,deletionScheduledAt:now,retentionEndsAt,deletionReason:r,deletionJob} as any),c)}

  async cancelDeletion(v:string){const c=code(v),t=needed(await this.tenants.get(c),c);if(t.lifecycleStatus!=="scheduled-deletion")throw Error("Tenant deletion is not scheduled");return needed(await this.tenants.update(c,{lifecycleStatus:"archived",lifecycleChangedAt:new Date(),deletionScheduledAt:null,retentionEndsAt:null,deletionReason:""}),c)}

  async getSummary(v:string){
    const c=code(v);
    await needed(await this.tenants.get(c),c);
    const [userCountAgg, company] = await Promise.all([
      UserModel.aggregate([{ $match: { companyCode: c } }, { $group: { _id: "$role", count: { $sum: 1 } } }]),
      CompanyModel.findOne({ code: c }).select("enabledModules").lean(),
    ]);
    const usersByRole: Record<string, number> = {};
    let userCount = 0;
    for (const row of userCountAgg) { usersByRole[row._id || "unknown"] = row.count; userCount += row.count; }
    const enabledModulesCount = Array.isArray((company as any)?.enabledModules) ? (company as any).enabledModules.length : 0;
    return { userCount, usersByRole, enabledModulesCount };
  }

  async listUsers(v:string){
    const c=code(v);
    await needed(await this.tenants.get(c),c);
    return UserModel.find({ companyCode: c }).select("displayName email role status createdAt").sort({ createdAt: -1 }).lean();
  }
}
