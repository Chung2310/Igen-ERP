import { logger } from "../config/logger";
import { Types } from "mongoose";
import { CustomerLeadModel, ICustomerLead } from "../model/customer-lead.model";
import { CompanyModel } from "../model/company.model";
import { BranchModel } from "../model/branch.model";

export interface SubmitPublicLeadPayload {
  companyCode: string;
  branchCode?: string;
  branchId?: string;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  serviceInterest?: string;
  preferredContactTime?: string;
  notes?: string;
  qrCampaign?: string;
}

export interface CreateManualLeadPayload {
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  serviceInterest?: string;
  preferredContactTime?: string;
  notes?: string;
  branchId?: string;
  source?: "qr_code" | "manual" | "website" | "referral";
  qrCampaign?: string;
  status?: "new" | "contacted" | "in_consultation" | "converted" | "cancelled";
  assignedTo?: string;
}

export interface UpdateLeadPayload {
  fullName?: string;
  phone?: string;
  email?: string;
  address?: string;
  serviceInterest?: string;
  preferredContactTime?: string;
  notes?: string;
  status?: "new" | "contacted" | "in_consultation" | "converted" | "cancelled";
  assignedTo?: string | null;
  branchId?: string | null;
  addNote?: string;
}

export interface LeadFilterOptions {
  companyCode: string;
  branchId?: string;
  status?: string;
  search?: string;
  source?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

import { normalizePhone } from "../utils/phone";
export { normalizePhone };

export async function getPublicCompanyInfo(companyCode: string, branchCode?: string) {
  const code = String(companyCode || "").toUpperCase().trim();
  const company = await CompanyModel.findOne({ code, lifecycleStatus: "active" }).select("code name");
  if (!company) {
    throw new Error("Không tìm thấy thông tin doanh nghiệp");
  }

  const branches = await BranchModel.find({ companyCode: code, isActive: true }).select(
    "code name address phone",
  );

  let selectedBranch = null;
  if (branchCode) {
    selectedBranch = branches.find((b) => b.code.toUpperCase() === branchCode.toUpperCase().trim()) || null;
  }

  return {
    companyCode: company.code,
    companyName: company.name,
    selectedBranch,
    branches,
  };
}

export async function submitPublicLead(payload: SubmitPublicLeadPayload) {
  const code = String(payload.companyCode || "").toUpperCase().trim();
  const company = await CompanyModel.findOne({ code, lifecycleStatus: "active" }).select("code name");
  if (!company) {
    throw new Error("Doanh nghiệp không tồn tại hoặc đã ngưng hoạt động");
  }

  const normalizedPhone = normalizePhone(payload.phone);

  // Chống spam lặp liên tục trong vòng 2 phút từ cùng một số điện thoại
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const recentLead = await CustomerLeadModel.findOne({
    companyCode: code,
    normalizedPhone,
    createdAt: { $gte: twoMinutesAgo },
    isDeleted: false,
  });
  if (recentLead) {
    return {
      success: true,
      leadId: recentLead._id,
      message: "Thông tin của bạn đã được ghi nhận trước đó. Chúng tôi sẽ liên hệ trong thời gian sớm nhất!",
    };
  }

  let branchDoc = null;
  if (payload.branchId && Types.ObjectId.isValid(payload.branchId)) {
    branchDoc = await BranchModel.findOne({ _id: payload.branchId, companyCode: code });
  } else if (payload.branchCode) {
    branchDoc = await BranchModel.findOne({
      code: payload.branchCode.toUpperCase().trim(),
      companyCode: code,
    });
  }

  const lead = await CustomerLeadModel.create({
    companyCode: code,
    branchId: branchDoc ? branchDoc._id : null,
    branchCode: branchDoc ? branchDoc.code : "",
    branchName: branchDoc ? branchDoc.name : "",
    fullName: payload.fullName.trim(),
    phone: payload.phone.trim(),
    normalizedPhone,
    email: payload.email?.trim() || "",
    address: payload.address?.trim() || "",
    serviceInterest: payload.serviceInterest?.trim() || "",
    preferredContactTime: payload.preferredContactTime?.trim() || "",
    notes: payload.notes?.trim() || "",
    source: "qr_code",
    qrCampaign: payload.qrCampaign?.trim() || "Quét mã QR",
    status: "new",
    contactHistory: [
      {
        date: new Date(),
        note: `Khách hàng đăng ký trực tuyến qua mã QR (${payload.qrCampaign || "Trực tiếp"})`,
        status: "new",
      },
    ],
  });

  // Gửi sự kiện realtime cho hệ thống Lux Care của công ty
  try {
    const { emitToCompany } = await import("../socket");
    emitToCompany(code, "customer_lead_created", {
      id: lead._id,
      fullName: lead.fullName,
      phone: lead.phone,
      branchName: lead.branchName,
      serviceInterest: lead.serviceInterest,
      source: lead.source,
      qrCampaign: lead.qrCampaign,
      createdAt: lead.createdAt,
    });
  } catch (socketError) {
    logger.warn("[CustomerLeadService] Emit socket notification failed:", socketError);
  }

  return {
    success: true,
    leadId: lead._id,
    message: "Gửi thông tin thành công. Lux Care xin chân thành cảm ơn Quý khách!",
  };
}

export async function listLeads(filters: LeadFilterOptions) {
  const query: any = {
    companyCode: filters.companyCode.toUpperCase().trim(),
    isDeleted: false,
  };

  if (filters.branchId && filters.branchId !== "all") {
    if (Types.ObjectId.isValid(filters.branchId)) {
      query.branchId = new Types.ObjectId(filters.branchId);
    }
  }

  if (filters.status && filters.status !== "all") {
    query.status = filters.status;
  }

  if (filters.source && filters.source !== "all") {
    query.source = filters.source;
  }

  if (filters.search) {
    const term = filters.search.trim();
    const cleanPhone = normalizePhone(term);
    query.$or = [
      { fullName: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
      { normalizedPhone: { $regex: cleanPhone, $options: "i" } },
      { email: { $regex: term, $options: "i" } },
      { serviceInterest: { $regex: term, $options: "i" } },
    ];
  }

  if (filters.fromDate || filters.toDate) {
    query.createdAt = {};
    if (filters.fromDate) {
      query.createdAt.$gte = new Date(filters.fromDate);
    }
    if (filters.toDate) {
      const end = new Date(filters.toDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
  const skip = (page - 1) * limit;

  const [total, leads] = await Promise.all([
    CustomerLeadModel.countDocuments(query),
    CustomerLeadModel.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("assignedTo", "displayName email photoURL")
      .lean(),
  ]);

  return {
    leads,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getLeadStats(companyCode: string, branchId?: string) {
  const code = companyCode.toUpperCase().trim();
  const match: any = { companyCode: code, isDeleted: false };
  if (branchId && branchId !== "all" && Types.ObjectId.isValid(branchId)) {
    match.branchId = new Types.ObjectId(branchId);
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [statusCounts, todayCount, total] = await Promise.all([
    CustomerLeadModel.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    CustomerLeadModel.countDocuments({
      ...match,
      createdAt: { $gte: startOfToday },
    }),
    CustomerLeadModel.countDocuments(match),
  ]);

  const counts: Record<string, number> = {
    total,
    todayNew: todayCount,
    new: 0,
    contacted: 0,
    in_consultation: 0,
    converted: 0,
    cancelled: 0,
  };

  for (const item of statusCounts) {
    if (item._id && counts[item._id] !== undefined) {
      counts[item._id] = item.count;
    }
  }

  return counts;
}

export async function getLeadById(id: string, companyCode: string) {
  const lead = await CustomerLeadModel.findOne({
    _id: id,
    companyCode: companyCode.toUpperCase().trim(),
    isDeleted: false,
  })
    .populate("assignedTo", "displayName email photoURL")
    .populate("contactHistory.updatedBy", "displayName email");

  if (!lead) {
    throw new Error("Không tìm thấy thông tin khách hàng");
  }

  return lead;
}

export async function createManualLead(
  payload: CreateManualLeadPayload,
  creator: { companyCode: string; uid: string; branchId?: string },
) {
  const code = creator.companyCode.toUpperCase().trim();
  const normalizedPhone = normalizePhone(payload.phone);

  let branchDoc = null;
  const targetBranchId = payload.branchId || creator.branchId;
  if (targetBranchId && Types.ObjectId.isValid(targetBranchId)) {
    branchDoc = await BranchModel.findOne({ _id: targetBranchId, companyCode: code });
  }

  const lead = await CustomerLeadModel.create({
    companyCode: code,
    branchId: branchDoc ? branchDoc._id : null,
    branchCode: branchDoc ? branchDoc.code : "",
    branchName: branchDoc ? branchDoc.name : "",
    fullName: payload.fullName.trim(),
    phone: payload.phone.trim(),
    normalizedPhone,
    email: payload.email?.trim() || "",
    address: payload.address?.trim() || "",
    serviceInterest: payload.serviceInterest?.trim() || "",
    preferredContactTime: payload.preferredContactTime?.trim() || "",
    notes: payload.notes?.trim() || "",
    source: payload.source || "manual",
    qrCampaign: payload.qrCampaign?.trim() || "Thêm thủ công",
    status: payload.status || "new",
    assignedTo:
      payload.assignedTo && Types.ObjectId.isValid(payload.assignedTo)
        ? new Types.ObjectId(payload.assignedTo)
        : null,
    contactHistory: [
      {
        date: new Date(),
        note: "Tạo khách hàng mới trên hệ thống",
        updatedBy: Types.ObjectId.isValid(creator.uid) ? new Types.ObjectId(creator.uid) : null,
        status: payload.status || "new",
      },
    ],
  });

  return lead;
}

export async function updateLead(
  id: string,
  payload: UpdateLeadPayload,
  updater: { companyCode: string; uid: string },
) {
  const lead = await CustomerLeadModel.findOne({
    _id: id,
    companyCode: updater.companyCode.toUpperCase().trim(),
    isDeleted: false,
  });

  if (!lead) {
    throw new Error("Không tìm thấy thông tin khách hàng");
  }

  if (payload.fullName) lead.fullName = payload.fullName.trim();
  if (payload.phone) {
    lead.phone = payload.phone.trim();
    lead.normalizedPhone = normalizePhone(payload.phone);
  }
  if (payload.email !== undefined) lead.email = payload.email.trim();
  if (payload.address !== undefined) lead.address = payload.address.trim();
  if (payload.serviceInterest !== undefined) lead.serviceInterest = payload.serviceInterest.trim();
  if (payload.preferredContactTime !== undefined) lead.preferredContactTime = payload.preferredContactTime.trim();
  if (payload.notes !== undefined) lead.notes = payload.notes.trim();

  if (payload.assignedTo !== undefined) {
    lead.assignedTo =
      payload.assignedTo && Types.ObjectId.isValid(payload.assignedTo)
        ? new Types.ObjectId(payload.assignedTo)
        : null;
  }

  if (payload.branchId !== undefined) {
    if (payload.branchId && Types.ObjectId.isValid(payload.branchId)) {
      const branch = await BranchModel.findOne({
        _id: payload.branchId,
        companyCode: updater.companyCode.toUpperCase().trim(),
      });
      lead.branchId = branch ? branch._id : null;
      lead.branchCode = branch ? branch.code : "";
      lead.branchName = branch ? branch.name : "";
    } else {
      lead.branchId = null;
      lead.branchCode = "";
      lead.branchName = "";
    }
  }

  const updaterObjectId = Types.ObjectId.isValid(updater.uid) ? new Types.ObjectId(updater.uid) : null;

  if (payload.status && payload.status !== lead.status) {
    const oldStatus = lead.status;
    lead.status = payload.status;
    lead.contactHistory.push({
      date: new Date(),
      note: `Chuyển trạng thái từ "${getStatusLabel(oldStatus)}" sang "${getStatusLabel(payload.status)}"`,
      updatedBy: updaterObjectId,
      status: payload.status,
    });
  }

  if (payload.addNote && payload.addNote.trim()) {
    lead.contactHistory.push({
      date: new Date(),
      note: payload.addNote.trim(),
      updatedBy: updaterObjectId,
      status: lead.status,
    });
  }

  await lead.save();
  return lead;
}

export async function deleteLead(id: string, user: { companyCode: string; uid: string }) {
  const lead = await CustomerLeadModel.findOne({
    _id: id,
    companyCode: user.companyCode.toUpperCase().trim(),
    isDeleted: false,
  });

  if (!lead) {
    throw new Error("Không tìm thấy thông tin khách hàng");
  }

  lead.isDeleted = true;
  lead.deletedAt = new Date();
  lead.deletedBy = Types.ObjectId.isValid(user.uid) ? new Types.ObjectId(user.uid) : null;
  await lead.save();

  return { success: true, message: "Đã xóa khách hàng thành công" };
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "new":
      return "Mới tiếp nhận";
    case "contacted":
      return "Đã liên hệ";
    case "in_consultation":
      return "Đang tư vấn";
    case "converted":
      return "Thành công";
    case "cancelled":
      return "Đã hủy";
    default:
      return status;
  }
}

export interface IngestExternalLeadPayload {
  companyCode: string;
  fullName?: string;
  name?: string;
  phone?: string;
  phoneNumber?: string;
  telephone?: string;
  email?: string;
  address?: string;
  serviceInterest?: string;
  service?: string;
  preferredContactTime?: string;
  notes?: string;
  note?: string;
  branchCode?: string;
  branchId?: string;
  source?: string;
  campaign?: string;
  qrCampaign?: string;
  [key: string]: any;
}

export async function ingestExternalLead(payload: IngestExternalLeadPayload) {
  const code = String(payload.companyCode || "").toUpperCase().trim();
  if (!code) {
    throw new Error("Mã doanh nghiệp (companyCode) là bắt buộc");
  }

  const company = await CompanyModel.findOne({ code, lifecycleStatus: "active" }).select("code name");
  if (!company) {
    throw new Error(`Doanh nghiệp với mã "${code}" không tồn tại hoặc đã ngưng hoạt động`);
  }

  const rawName = String(payload.fullName || payload.name || "").trim();
  if (!rawName || rawName.length < 2) {
    throw new Error("Tên khách hàng (fullName/name) phải có ít nhất 2 ký tự");
  }

  const rawPhone = String(payload.phone || payload.phoneNumber || payload.telephone || "").trim();
  if (!rawPhone) {
    throw new Error("Số điện thoại (phone/phoneNumber) là bắt buộc");
  }

  const normalizedPhone = normalizePhone(rawPhone);
  const phoneRegex = /^(0|\+84)[0-9]{8,11}$/;
  if (!phoneRegex.test(normalizedPhone)) {
    throw new Error(`Số điện thoại "${rawPhone}" không đúng định dạng`);
  }

  // Chống gửi lặp liên tục trong vòng 2 phút
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const recentLead = await CustomerLeadModel.findOne({
    companyCode: code,
    normalizedPhone,
    createdAt: { $gte: twoMinutesAgo },
    isDeleted: false,
  });

  if (recentLead) {
    return {
      success: true,
      leadId: recentLead._id,
      isDuplicate: true,
      message: "Thông tin khách hàng đã được ghi nhận trước đó từ ứng dụng ngoài.",
      data: {
        id: recentLead._id,
        fullName: recentLead.fullName,
        phone: recentLead.phone,
        status: recentLead.status,
        source: recentLead.source,
        createdAt: recentLead.createdAt,
      },
    };
  }

  let branchDoc = null;
  if (payload.branchId && Types.ObjectId.isValid(payload.branchId)) {
    branchDoc = await BranchModel.findOne({ _id: payload.branchId, companyCode: code });
  } else if (payload.branchCode) {
    branchDoc = await BranchModel.findOne({
      code: String(payload.branchCode).toUpperCase().trim(),
      companyCode: code,
    });
  }

  const source = String(payload.source || "external_app").trim();
  const campaign = String(payload.campaign || payload.qrCampaign || "Tích hợp ứng dụng ngoài").trim();
  const serviceInterest = String(payload.serviceInterest || payload.service || "").trim();
  const notes = String(payload.notes || payload.note || "").trim();

  const lead = await CustomerLeadModel.create({
    companyCode: code,
    branchId: branchDoc ? branchDoc._id : null,
    branchCode: branchDoc ? branchDoc.code : "",
    branchName: branchDoc ? branchDoc.name : "",
    fullName: rawName,
    phone: rawPhone,
    normalizedPhone,
    email: payload.email?.trim() || "",
    address: payload.address?.trim() || "",
    serviceInterest,
    preferredContactTime: payload.preferredContactTime?.trim() || "",
    notes,
    source,
    qrCampaign: campaign,
    status: "new",
    contactHistory: [
      {
        date: new Date(),
        note: `Tiếp nhận tự động qua API từ ứng dụng ngoài (Nguồn: ${source} - ${campaign})`,
        status: "new",
      },
    ],
  });

  // Gửi sự kiện realtime cho hệ thống Lux Care của công ty
  try {
    const { emitToCompany } = await import("../socket");
    emitToCompany(code, "customer_lead_created", {
      id: lead._id,
      fullName: lead.fullName,
      phone: lead.phone,
      branchName: lead.branchName,
      serviceInterest: lead.serviceInterest,
      source: lead.source,
      qrCampaign: lead.qrCampaign,
      createdAt: lead.createdAt,
    });
  } catch (socketError) {
    logger.warn("[CustomerLeadService] Emit socket notification failed:", socketError);
  }

  return {
    success: true,
    leadId: lead._id,
    isDuplicate: false,
    message: "Tiếp nhận thông tin khách hàng thành công",
    data: {
      id: lead._id,
      fullName: lead.fullName,
      phone: lead.phone,
      branchName: lead.branchName,
      status: lead.status,
      source,
      createdAt: lead.createdAt,
    },
  };
}

export interface BatchExternalLeadOptions {
  companyCode?: string;
  source?: string;
  branchCode?: string;
  branchId?: string;
  campaign?: string;
  apiKey?: string;
}

export async function ingestExternalLeadsBatch(
  items: IngestExternalLeadPayload[],
  commonMeta?: BatchExternalLeadOptions,
) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Danh sách khách hàng không được để trống");
  }
  if (items.length > 200) {
    throw new Error("Mỗi lần gửi danh sách tối đa 200 khách hàng");
  }

  const results: any[] = [];
  let successCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const mergedPayload: IngestExternalLeadPayload = {
      ...item,
      companyCode: item.companyCode || commonMeta?.companyCode,
      source: item.source || commonMeta?.source || "external_app",
      branchCode: item.branchCode || commonMeta?.branchCode,
      branchId: item.branchId || commonMeta?.branchId,
      campaign: item.campaign || item.qrCampaign || commonMeta?.campaign,
      apiKey: item.apiKey || commonMeta?.apiKey,
    };

    try {
      const res = await ingestExternalLead(mergedPayload);
      if (res.isDuplicate) {
        duplicateCount++;
      } else {
        successCount++;
      }
      results.push({
        index: i,
        success: true,
        isDuplicate: Boolean(res.isDuplicate),
        leadId: res.leadId,
        fullName: res.data?.fullName || item.fullName || item.name,
        phone: res.data?.phone || item.phone || item.phoneNumber,
        message: res.message,
      });
    } catch (err: any) {
      failedCount++;
      results.push({
        index: i,
        success: false,
        isDuplicate: false,
        fullName: item.fullName || item.name || "",
        phone: item.phone || item.phoneNumber || item.telephone || "",
        error: err.message || "Lỗi không xác định",
      });
    }
  }

  return {
    success: failedCount === 0 || successCount > 0,
    message: `Đã xử lý ${items.length} khách hàng (${successCount} mới, ${duplicateCount} trùng lặp, ${failedCount} lỗi)`,
    total: items.length,
    successCount,
    duplicateCount,
    failedCount,
    data: results,
  };
}

