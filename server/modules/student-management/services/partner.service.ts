import { ConflictError, NotFoundError } from "../../../errors/app-error";
import { Partner } from "../models/partner.model";
import { Student } from "../models/student.model";
import { CommissionLevel } from "../models/commission-level.model";
import { ICommissionLevel } from "../interfaces/commission-level.interface";
import { IPartner } from "../interfaces/partner.interface";
import { logger } from "../config/logger";
import { resolveOwnerFilter } from "../utils/auth.util";
import { resolveCustomFieldTenantForOwner } from "../utils/custom-field.util";
import {
  customFieldWriteService,
  CustomFieldWriteConflictError,
  expectedVersionOf,
  type CustomFieldWriteContext,
} from "./custom-field-write.service";

interface PartnerFilters {
  page?: number | string;
  limit?: number | string;
  search?: string;
  isActive?: boolean | string;
  ownerFilter?: string;
}

interface PartnerData {
  [key: string]: unknown;
  name: string;
  phone: string;
  email?: string;
  commissionType: "percentage" | "fixed";
  commissionValue: number;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  isActive?: boolean;
  notes?: string;
}

export interface BulkPartnerInput {
  name?: string;
  phone?: string;
  email?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  isActive?: boolean | string;
  notes?: string;
  centerId?: string;
}

function normalizePhone(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

export interface EnrichedPartner {
  _id: string;
  name: string;
  phone: string;
  email: string;
  commissionType: "percentage" | "fixed";
  commissionValue: number;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  isActive: boolean;
  ownerId: string;
  notes: string;
  payoutHistory: Array<{
    id: string;
    amount: number;
    date: string;
    method: "Tiền mặt" | "Chuyển khoản";
    note?: string;
  }>;
  referredStudentsCount: number;
  totalCommission: number;
  totalPaid: number;
  unpaidBalance: number;
  createdAt?: Date;
  updatedAt?: Date;
  levelName?: string;
  totalReferredTuition?: number;
}

function buildOwnerQuery(ownerId: string | string[]): Record<string, unknown> {
  if (ownerId === "ALL") return {};
  return { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
}

function buildBranchScopeQuery(branchId?: string): Record<string, unknown> {
  return branchId ? { branchId } : {};
}

function parseCurrency(val: string | undefined): number {
  return parseInt(String(val || "").replace(/\D/g, ""), 10) || 0;
}

const DEFAULT_LEVELS = [
  { name: "Cấp 1", minTuition: 0, commissionRate: 5 },
  { name: "Cấp 2", minTuition: 50000000, commissionRate: 8 },
  { name: "Cấp 3", minTuition: 100000000, commissionRate: 10 },
];

async function enrichPartners(partners: IPartner[], branchId?: string): Promise<EnrichedPartner[]> {
  const partnerIds = partners.map(p => p._id.toString());
  const ownerIds = Array.from(new Set(partners.map(p => p.ownerId)));
  
  // Find all students referred by these partners
  const students = await Student.find({ partnerId: { $in: partnerIds } })
    .select("_id partnerId fee status");

  const studentMapByPartner = new Map<string, typeof students>();
  for (const s of students) {
    if (s.partnerId) {
      if (!studentMapByPartner.has(s.partnerId)) {
        studentMapByPartner.set(s.partnerId, []);
      }
      studentMapByPartner.get(s.partnerId)!.push(s);
    }
  }

  // Fetch commission levels for these centers
  const levels = await CommissionLevel.find({ ownerId: { $in: ownerIds }, ...buildBranchScopeQuery(branchId) }).sort({ minTuition: 1 });
  const levelsMapByOwner = new Map<string, ICommissionLevel[]>();
  for (const lvl of levels) {
    if (!levelsMapByOwner.has(lvl.ownerId)) {
      levelsMapByOwner.set(lvl.ownerId, []);
    }
    levelsMapByOwner.get(lvl.ownerId)!.push(lvl);
  }

  return partners.map(p => {
    const pId = p._id.toString();
    const referredStudents = studentMapByPartner.get(pId) || [];
    
    // Calculate total referred tuition
    const totalReferredTuition = referredStudents.reduce((sum, s) => sum + parseCurrency(s.fee), 0);

    // Match commission level
    const centerLevels = levelsMapByOwner.get(p.ownerId) || [];
    const activeLevels = centerLevels.length > 0 ? centerLevels : DEFAULT_LEVELS;
    
    // Find the highest qualifying level (must meet minTuition threshold)
    let matchedLevel: { name: string; minTuition: number; commissionRate: number } | null = null;
    for (const lvl of activeLevels) {
      if (totalReferredTuition >= lvl.minTuition) {
        matchedLevel = lvl;
      }
    }

    // If no level is qualified (below first tier's threshold), commission = 1%
    const commissionRate = matchedLevel ? matchedLevel.commissionRate : 1;
    const levelName = matchedLevel ? matchedLevel.name : "Mặc định";

    // Calculate total commission earned using matched level's percentage rate
    let totalCommission = 0;
    for (const student of referredStudents) {
      const fee = parseCurrency(student.fee);
      totalCommission += Math.round((fee * commissionRate) / 100);
    }

    // Calculate paid amount from payoutHistory
    const totalPaid = (p.payoutHistory || []).reduce((sum, pay) => sum + pay.amount, 0);
    const unpaidBalance = totalCommission - totalPaid;

    return {
      ...p.toObject(),
      _id: pId,
      commissionType: "percentage",
      commissionValue: commissionRate,
      levelName,
      totalReferredTuition,
      referredStudentsCount: referredStudents.length,
      totalCommission,
      totalPaid,
      unpaidBalance,
    } as EnrichedPartner;
  });
}

export interface ReferredStudentItem {
  _id: string;
  fullName: string;
  phone: string;
  status: string[];
  fee: string;
  registrationDate: string;
  commission: number;
}

export class PartnerService {
  static customFieldWrites = customFieldWriteService;

  static async createPartner(
    ownerId: string,
    data: PartnerData,
    context: CustomFieldWriteContext,
  ): Promise<EnrichedPartner> {
    const branchId = typeof data.branchId === "string" ? data.branchId : undefined;
    logger.info(`[Partner] Creating partner name=${data.name}, phone=${data.phone} for ownerId=${ownerId}`);
    
    const writeData = await this.customFieldWrites.prepareCreate(context, data);
    const existing = await Partner.findOne({ ownerId, phone: writeData.phone, ...buildBranchScopeQuery(branchId) });
    if (existing) {
      throw new ConflictError("PARTNER_PHONE_ALREADY_EXISTS", "Số điện thoại đã tồn tại cho đối tác của trung tâm.", { field: "phone" });
    }

    const partner = new Partner({ ...writeData, ownerId, branchId });
    const saved = await partner.save();
    logger.info(`[Partner] Partner created: id=${saved._id}`);
    
    const enriched = await enrichPartners([saved], branchId);
    return enriched[0];
  }

  static async bulkCreatePartners(
    creatorId: string,
    ownerId: string | string[],
    partnersData: BulkPartnerInput[],
    targetOwnerId?: string,
    branchId?: string,
  ) {
    let importedCount = 0;
    let skippedCount = 0;
    const errors: { row: number; name: string; phone: string; reason: string }[] = [];
    const validPartners: Partial<IPartner>[] = [];
    const seenPhonesInBatch = new Set<string>();

    const query = { ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) };
    const existingPartners = await Partner.find(query).select("phone");
    const existingPhones = new Set(existingPartners.map((p) => normalizePhone(p.phone)));

    for (let i = 0; i < partnersData.length; i++) {
      const rowNum = i + 1;
      const data = partnersData[i];
      const name = String(data.name || "").trim();
      const phone = normalizePhone(String(data.phone || ""));

      if (!name) {
        errors.push({ row: rowNum, name, phone, reason: "Tên đối tác không được để trống." });
        skippedCount++;
        continue;
      }
      if (!phone) {
        errors.push({ row: rowNum, name, phone, reason: "Số điện thoại không được để trống." });
        skippedCount++;
        continue;
      }

      if (seenPhonesInBatch.has(phone)) {
        errors.push({ row: rowNum, name, phone, reason: "Số điện thoại bị trùng lặp trong file import." });
        skippedCount++;
        continue;
      }
      seenPhonesInBatch.add(phone);

      if (existingPhones.has(phone)) {
        errors.push({ row: rowNum, name, phone, reason: "Số điện thoại đối tác đã tồn tại trong trung tâm." });
        skippedCount++;
        continue;
      }

      let isActive = true;
      if (typeof data.isActive === "boolean") {
        isActive = data.isActive;
      } else if (typeof data.isActive === "string") {
        const normStatus = data.isActive.trim().toLowerCase();
        if (
          normStatus === "ngung hoat dong" ||
          normStatus === "tam dung" ||
          normStatus === "inactive" ||
          normStatus === "false"
        ) {
          isActive = false;
        }
      }

      const partnerOwnerId = targetOwnerId || creatorId;

      validPartners.push({
        name,
        phone,
        email: String(data.email || "").trim().toLowerCase() || "",
        bankName: String(data.bankName || "").trim(),
        bankAccountNo: String(data.bankAccountNo || "").replace(/\D/g, ""),
        bankAccountName: String(data.bankAccountName || "").trim(),
        isActive,
        notes: String(data.notes || "").trim(),
        ownerId: partnerOwnerId,
        branchId,
        commissionType: "fixed",
        commissionValue: 0,
        payoutHistory: [],
      });

      existingPhones.add(phone);
    }

    if (validPartners.length > 0) {
      const results = await Partner.insertMany(validPartners);
      importedCount = results.length;
      logger.info(`[Partner] Bulk import complete: imported=${importedCount}, skipped=${skippedCount}`);
    }

    return {
      importedCount,
      skippedCount,
      errors,
    };
  }

  static async getPartners(ownerId: string | string[], filters: PartnerFilters, branchId?: string) {
    const page = filters.page ? parseInt(String(filters.page)) : 1;
    const limit = filters.limit ? parseInt(String(filters.limit)) : 1000;
    const skip = (page - 1) * limit;

    const resolvedOwnerId = await resolveOwnerFilter(ownerId, filters.ownerFilter);

    const query: Record<string, unknown> = { ...buildOwnerQuery(resolvedOwnerId), ...buildBranchScopeQuery(branchId) };
    if (filters.isActive !== undefined && filters.isActive !== "") {
      query.isActive = String(filters.isActive) === "true";
    }
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { phone: { $regex: filters.search, $options: "i" } },
      ];
    }

    const total = await Partner.countDocuments(query);
    const partners = await Partner.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const enriched = await enrichPartners(partners, branchId);

    return { partners: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
  

  static async getPartnerById(
    ownerId: string | string[],
    id: string,
    branchId?: string,
  ): Promise<(EnrichedPartner & { referredStudents: ReferredStudentItem[] }) | null> {
    const partner = await Partner.findOne({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    if (!partner) return null;

    const enriched = (await enrichPartners([partner], branchId))[0];

    // Fetch detailed list of referred students
    const students = await Student.find({ partnerId: id }).sort({ createdAt: -1 });
    const studentsList = students.map(student => {
      const commission = partner.commissionType === "fixed"
        ? partner.commissionValue
        : Math.round((parseCurrency(student.fee) * partner.commissionValue) / 100);

      return {
        _id: student._id.toString(),
        fullName: student.fullName,
        phone: student.phone,
        status: student.status,
        fee: student.fee,
        registrationDate: student.registrationDate,
        commission,
      };
    });

    return {
      ...enriched,
      referredStudents: studentsList,
    };
  }

  static async updatePartner(
    ownerId: string | string[],
    id: string,
    data: Partial<PartnerData>,
    context: CustomFieldWriteContext,
    branchId?: string,
  ): Promise<EnrichedPartner | null> {
    logger.info(`[Partner] Updating partner: id=${id}`);
    
    const partner = await Partner.findOne({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    if (!partner) {
      throw new NotFoundError("PARTNER_NOT_FOUND", "Không tìm thấy đối tác.");
    }

    const expectedVersion = expectedVersionOf(data);
    const targetContext = context.actorRole === "superadmin" ? { ...context, tenantId: await resolveCustomFieldTenantForOwner(partner.ownerId) } : context;
    const writeData = await this.customFieldWrites.prepareUpdate(targetContext, partner, data);

    if (writeData.phone && writeData.phone !== partner.phone) {
      const dup = await Partner.findOne({ ownerId: partner.ownerId, phone: writeData.phone, ...buildBranchScopeQuery(branchId) });
      if (dup) {
        throw new ConflictError("PARTNER_PHONE_ALREADY_EXISTS", "Số điện thoại đã tồn tại cho một đối tác khác.", { field: "phone" });
      }
    }

    const saved = await Partner.findOneAndUpdate(
      { _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId), ...(expectedVersion === undefined ? {} : { __v: expectedVersion }) },
      { $set: writeData, $inc: { __v: 1 } },
      { new: true, runValidators: true },
    );
    if (!saved) throw new CustomFieldWriteConflictError();
    
    const enriched = await enrichPartners([saved], branchId);
    return enriched[0];
  }

  static async deletePartner(ownerId: string | string[], id: string, branchId?: string): Promise<IPartner | null> {
    logger.info(`[Partner] Deleting partner: id=${id}`);
    
    // Check if partner has referred students
    const studentCount = await Student.countDocuments({ partnerId: id });
    if (studentCount > 0) {
      throw new ConflictError("PARTNER_HAS_REFERRED_STUDENTS", `Không thể xóa đối tác vì đã giới thiệu ${studentCount} học viên. Vui lòng vô hiệu hóa thay vì xóa.`, { studentCount });
    }

    return await Partner.findOneAndDelete({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
  }

  static async addPayout(
    ownerId: string | string[],
    id: string,
    payoutData: { amount: number; date: string; method: "Tiền mặt" | "Chuyển khoản"; note?: string },
    branchId?: string,
  ): Promise<EnrichedPartner> {
    logger.info(`[Partner] Adding payout for partner: id=${id}, amount=${payoutData.amount}`);
    
    const partner = await Partner.findOne({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
    if (!partner) {
      throw new NotFoundError("PARTNER_NOT_FOUND", "Không tìm thấy đối tác.");
    }

    const newPayout = {
      id: new mongoose.Types.ObjectId().toString(),
      ...payoutData,
    };

    partner.payoutHistory = partner.payoutHistory || [];
    partner.payoutHistory.push(newPayout);
    
    const saved = await partner.save();
    const enriched = await enrichPartners([saved], branchId);
    return enriched[0];
  }

  static async getCommissionLevels(ownerId: string | string[], branchId?: string): Promise<ICommissionLevel[]> {
    logger.info(`[PartnerService] Fetching commission levels for ownerId: ${ownerId}`);
    return await CommissionLevel.find({ ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) }).sort({ minTuition: 1 });
  }

  static async createCommissionLevel(
    ownerId: string,
    data: { name: string; minTuition: number; commissionRate: number; branchId?: string }
  ): Promise<ICommissionLevel> {
    logger.info(`[PartnerService] Creating commission level for ownerId: ${ownerId}, name: ${data.name}`);
    
    // Check unique name per ownerId
    const existing = await CommissionLevel.findOne({ name: data.name, ownerId });
    if (existing) {
      throw new ConflictError("COMMISSION_LEVEL_ALREADY_EXISTS", "Cấp bậc hoa hồng đã tồn tại.", { field: "name" });
    }

    const level = new CommissionLevel({
      ...data,
      ownerId,
    });
    return await level.save();
  }

  static async deleteCommissionLevel(ownerId: string | string[], id: string, branchId?: string): Promise<ICommissionLevel | null> {
    logger.info(`[PartnerService] Deleting commission level id: ${id}`);
    return await CommissionLevel.findOneAndDelete({ _id: id, ...buildOwnerQuery(ownerId), ...buildBranchScopeQuery(branchId) });
  }
}

import mongoose from "mongoose";
