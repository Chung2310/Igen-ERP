import { EquipmentModel } from "../model/equipment.model";
import { EquipmentInspectionModel } from "../model/equipment-inspection.model";
import { BranchModel } from "../model/branch.model";
import { DepartmentModel } from "../model/department.model";

export function normalizeEquipmentImportStatus(value: unknown) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "bảo trì" || status === "maintenance") return "maintenance";
  if (status === "thanh lý" || status === "retired") return "retired";
  return "available";
}

export const isEquipmentWorkflowLocked = (status: unknown) => status === "requested" || status === "in-use";

export type EquipmentListFilter = {
  search?: string;
  status?: string;
  category?: string;
  departmentId?: string;
  branchId?: string;
  riskClassification?: string;
  inspectionStatus?: "all" | "overdue" | "due_soon" | "valid" | "none" | string;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildEquipmentFilter(companyCode: string, query: EquipmentListFilter) {
  const filter: any = { companyCode };
  if (query.branchId) filter.branchId = query.branchId;
  if (query.departmentId) filter.departmentId = query.departmentId;
  if (query.status) filter.status = query.status;
  if (query.riskClassification) filter.riskClassification = query.riskClassification;

  const category = String(query.category || "").trim();
  if (category) filter.category = { $regex: escapeRegex(category), $options: "i" };

  const andClauses: any[] = [];

  if (query.search) {
    andClauses.push({
      $or: [
        { name: { $regex: query.search, $options: "i" } },
        { code: { $regex: query.search, $options: "i" } },
        { serialNumber: { $regex: query.search, $options: "i" } },
        { modelNumber: { $regex: query.search, $options: "i" } },
        { manufacturer: { $regex: query.search, $options: "i" } },
      ],
    });
  }

  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (query.inspectionStatus === "overdue") {
    andClauses.push({
      nextInspectionDate: { $ne: null, $lt: now },
    });
  } else if (query.inspectionStatus === "due_soon") {
    andClauses.push({
      nextInspectionDate: { $gte: now, $lte: thirtyDaysLater },
    });
  } else if (query.inspectionStatus === "valid") {
    andClauses.push({
      nextInspectionDate: { $gt: thirtyDaysLater },
    });
  } else if (query.inspectionStatus === "none") {
    andClauses.push({
      $or: [{ nextInspectionDate: { $exists: false } }, { nextInspectionDate: null }],
    });
  }

  if (andClauses.length > 0) {
    filter.$and = andClauses;
  }

  return filter;
}


export function expandEquipmentImportRows(items: any[]) {
  const expanded: any[] = [];
  const codes = new Set<string>();

  for (const item of items) {
    const baseCode = String(item.code || "").trim();
    const rawQuantity = item.quantity;
    const quantity = rawQuantity === undefined || rawQuantity === null || rawQuantity === "" ? 1 : Number(rawQuantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Số lượng của mã '${baseCode || "không xác định"}' phải là số nguyên dương.`);
    }

    for (let index = 1; index <= quantity; index += 1) {
      const code = index === 1 ? baseCode : `${baseCode}-${String(index).padStart(2, "0")}`;
      if (codes.has(code)) throw new Error(`Mã thiết bị bị trùng lặp trong file: ${code}`);
      codes.add(code);
      const { quantity: _quantity, ...rest } = item;
      expanded.push({ ...rest, code });
    }
  }

  return expanded;
}

export function sanitizeEquipmentPayload(data: any) {
  if (!data || typeof data !== "object") return data;
  const cleaned: any = { ...data };

  if (cleaned.riskClassification === "") {
    cleaned.riskClassification = null;
  }
  if (cleaned.lastInspectionResult === "") {
    cleaned.lastInspectionResult = null;
  }
  if (cleaned.roomId === "") {
    cleaned.roomId = null;
  }
  if (cleaned.branchId === "") {
    delete cleaned.branchId;
  }

  const dateFields = ["purchaseDate", "usageStartDate", "lastInspectionDate", "nextInspectionDate"];
  for (const f of dateFields) {
    if (cleaned[f] === "") {
      cleaned[f] = null;
    }
  }

  if (Array.isArray(cleaned.legalDocuments)) {
    cleaned.legalDocuments = cleaned.legalDocuments.map((doc: any) => {
      if (!doc || typeof doc !== "object") return doc;
      const docCleaned = { ...doc };
      if (
        typeof docCleaned._id === "string" &&
        (!/^[0-9a-fA-F]{24}$/.test(docCleaned._id) || docCleaned._id.startsWith("doc_"))
      ) {
        delete docCleaned._id;
      }
      return docCleaned;
    });
  }

  return cleaned;
}

async function resolveEquipmentDepartment(companyCode: string, data: any) {
  if (data.departmentId === undefined) return {};
  if (!data.departmentId) return { departmentId: null, departmentName: "" };
  const department = await DepartmentModel.findOne({ _id: data.departmentId, companyCode }).select("name").lean();
  if (!department) throw new Error("Phòng ban không tồn tại trong doanh nghiệp.");
  return { departmentId: String(department._id), departmentName: department.name };
}

export const equipmentService = {
  list: async (
    companyCode: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      category?: string;
      branchId?: string;
    },
  ) => {
    const filter = buildEquipmentFilter(companyCode, query);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      EquipmentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      EquipmentModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  },

  listAllForExport: async (
    companyCode: string,
    query: {
      search?: string;
      status?: string;
      category?: string;
      branchId?: string;
    },
  ) => {
    const filter = buildEquipmentFilter(companyCode, query);

    return EquipmentModel.find(filter).sort({ createdAt: -1 }).lean();
  },

  get: (companyCode: string, id: string) => EquipmentModel.findOne({ _id: id, companyCode }).lean(),

  create: async (companyCode: string, data: any) => EquipmentModel.create({ ...sanitizeEquipmentPayload(data), ...await resolveEquipmentDepartment(companyCode, data), companyCode }),

  update: async (companyCode: string, id: string, data: any) =>
    EquipmentModel.findOneAndUpdate(
      { _id: id, companyCode, status: { $nin: ["requested", "in-use"] } },
      { ...sanitizeEquipmentPayload(data), ...await resolveEquipmentDepartment(companyCode, data) },
      {
        returnDocument: "after",
        runValidators: true,
      }
    ).lean(),

  remove: (companyCode: string, id: string) => EquipmentModel.deleteOne({ _id: id, companyCode, status: { $nin: ["requested", "in-use"] } }),

  importMany: async (companyCode: string, items: any[], defaultBranchId?: string) => {
    const expandedItems = expandEquipmentImportRows(items);
    // Fetch all branches of this company to resolve branch codes/names to IDs
    const branches = await BranchModel.find({ companyCode }).select("_id code name").lean();
    const branchCodeMap = new Map<string, string>();
    const branchNameMap = new Map<string, string>();
    const branchIdSet = new Set<string>();

    for (const b of branches) {
      const idStr = b._id.toString();
      branchIdSet.add(idStr);
      if (b.code) {
        branchCodeMap.set(b.code.trim().toUpperCase(), idStr);
      }
      if (b.name) {
        branchNameMap.set(b.name.trim().toLowerCase(), idStr);
      }
    }

    const uniqueItems: any[] = [];
    const codes = new Set<string>();

    for (const item of expandedItems) {
      if (!item.code || !item.name || !item.category) {
        throw new Error(
          `Thiếu các trường bắt buộc (Tên thiết bị, Mã thiết bị, Danh mục) đối với dòng dữ liệu: ${JSON.stringify(
            item,
          )}`,
        );
      }
      const trimCode = String(item.code).trim();
      codes.add(trimCode);

      // Trạng thái mượn/đang dùng chỉ được tạo bởi quy trình mượn trả.
      const status = normalizeEquipmentImportStatus(item.status);

      // Parse purchase date if present
      let purchaseDate: Date | undefined;
      if (item.purchaseDate) {
        const d = new Date(item.purchaseDate);
        if (!isNaN(d.getTime())) {
          purchaseDate = d;
        }
      }

      // Resolve branchId
      let resolvedBranchId: string | undefined = undefined;
      const rawBranchVal = item.branchId ? String(item.branchId).trim() : "";

      if (rawBranchVal) {
        const upperVal = rawBranchVal.toUpperCase();
        const lowerVal = rawBranchVal.toLowerCase();

        if (branchCodeMap.has(upperVal)) {
          resolvedBranchId = branchCodeMap.get(upperVal);
        } else if (branchNameMap.has(lowerVal)) {
          resolvedBranchId = branchNameMap.get(lowerVal);
        } else if (branchIdSet.has(rawBranchVal)) {
          resolvedBranchId = rawBranchVal;
        } else {
          throw new Error(`Chi nhánh '${rawBranchVal}' không tồn tại trong hệ thống.`);
        }
      } else {
        resolvedBranchId = defaultBranchId || undefined;
      }

      uniqueItems.push({
        companyCode,
        name: String(item.name).trim(),
        code: trimCode,
        category: String(item.category).trim(),
        status,
        location: item.location ? String(item.location).trim() : undefined,
        purchaseDate,
        notes: item.notes ? String(item.notes).trim() : undefined,
        branchId: resolvedBranchId,
      });
    }

    // Check against DB
    const existing = await EquipmentModel.find({
      companyCode,
      code: { $in: Array.from(codes) },
    })
      .select("code")
      .lean();

    if (existing.length > 0) {
      const existingCodes = existing.map((e) => e.code);
      throw new Error(`Các mã thiết bị sau đã tồn tại trong hệ thống: ${existingCodes.join(", ")}`);
    }

    return EquipmentModel.insertMany(uniqueItems);
  },

  /**
   * Thống kê tổng quan hồ sơ pháp lý & tình trạng kiểm định
   */
  getComplianceSummary: async (companyCode: string, branchId?: string) => {
    const baseFilter: any = { companyCode };
    if (branchId) baseFilter.branchId = branchId;

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      total,
      overdue,
      dueSoon,
      valid,
      none,
      countA,
      countB,
      countC,
      countD,
    ] = await Promise.all([
      EquipmentModel.countDocuments(baseFilter),
      EquipmentModel.countDocuments({
        ...baseFilter,
        nextInspectionDate: { $ne: null, $lt: now },
      }),
      EquipmentModel.countDocuments({
        ...baseFilter,
        nextInspectionDate: { $gte: now, $lte: thirtyDaysLater },
      }),
      EquipmentModel.countDocuments({
        ...baseFilter,
        nextInspectionDate: { $gt: thirtyDaysLater },
      }),
      EquipmentModel.countDocuments({
        ...baseFilter,
        $or: [{ nextInspectionDate: { $exists: false } }, { nextInspectionDate: null }],
      }),
      EquipmentModel.countDocuments({ ...baseFilter, riskClassification: "A" }),
      EquipmentModel.countDocuments({ ...baseFilter, riskClassification: "B" }),
      EquipmentModel.countDocuments({ ...baseFilter, riskClassification: "C" }),
      EquipmentModel.countDocuments({ ...baseFilter, riskClassification: "D" }),
    ]);

    return {
      total,
      overdue,
      dueSoon,
      valid,
      none,
      classifications: {
        A: countA,
        B: countB,
        C: countC,
        D: countD,
      },
    };
  },

  /**
   * Thêm hồ sơ pháp lý vào thiết bị
   */
  addLegalDocument: async (
    companyCode: string,
    equipmentId: string,
    documentData: {
      title: string;
      type: string;
      documentNumber?: string;
      fileUrl: string;
      fileName?: string;
      fileSize?: number;
      issuedDate?: string | Date;
      expiryDate?: string | Date;
      issuingAuthority?: string;
      notes?: string;
    },
    actorName?: string,
  ) => {
    const equipment = await EquipmentModel.findOne({ _id: equipmentId, companyCode });
    if (!equipment) {
      throw new Error("Không tìm thấy thiết bị yêu cầu.");
    }

    const docToAdd: any = {
      ...documentData,
      uploadedAt: new Date(),
      uploadedBy: actorName || "Hệ thống",
    };
    if (documentData.issuedDate) docToAdd.issuedDate = new Date(documentData.issuedDate);
    if (documentData.expiryDate) docToAdd.expiryDate = new Date(documentData.expiryDate);

    equipment.legalDocuments = equipment.legalDocuments || [];
    equipment.legalDocuments.push(docToAdd);
    await equipment.save();

    return equipment;
  },

  /**
   * Xóa hồ sơ pháp lý khỏi thiết bị
   */
  removeLegalDocument: async (companyCode: string, equipmentId: string, docId: string) => {
    const updated = await EquipmentModel.findOneAndUpdate(
      { _id: equipmentId, companyCode },
      { $pull: { legalDocuments: { _id: docId } } },
      { returnDocument: "after" },
    ).lean();

    if (!updated) {
      throw new Error("Không tìm thấy thiết bị hoặc tài liệu yêu cầu.");
    }
    return updated;
  },

  /**
   * Ghi nhận một đợt kiểm định / hiệu chuẩn / bảo trì mới
   */
  recordInspection: async (
    companyCode: string,
    equipmentId: string,
    data: {
      type: "inspection" | "calibration" | "maintenance";
      performedDate: string | Date;
      nextDueDate?: string | Date;
      serviceProvider: string;
      inspectorName?: string;
      result: "pass" | "fail" | "conditional";
      certificateNumber?: string;
      reportFileUrl?: string;
      reportFileName?: string;
      cost?: number;
      notes?: string;
    },
    userId?: string,
  ) => {
    const equipment = await EquipmentModel.findOne({ _id: equipmentId, companyCode });
    if (!equipment) {
      throw new Error("Không tìm thấy thiết bị yêu cầu.");
    }

    const performedDate = new Date(data.performedDate);
    let nextDueDate: Date;

    if (data.nextDueDate) {
      nextDueDate = new Date(data.nextDueDate);
    } else {
      const cycleMonths = equipment.inspectionCycleMonths && equipment.inspectionCycleMonths > 0 ? equipment.inspectionCycleMonths : 12;
      nextDueDate = new Date(performedDate.getTime());
      nextDueDate.setMonth(nextDueDate.getMonth() + cycleMonths);
    }

    const inspectionRecord = await EquipmentInspectionModel.create({
      companyCode,
      branchId: equipment.branchId,
      equipmentId: equipment._id,
      type: data.type,
      performedDate,
      nextDueDate,
      serviceProvider: data.serviceProvider,
      inspectorName: data.inspectorName,
      result: data.result || "pass",
      certificateNumber: data.certificateNumber,
      reportFileUrl: data.reportFileUrl,
      reportFileName: data.reportFileName,
      cost: data.cost,
      notes: data.notes,
      performedByUserId: userId,
    });

    // Cập nhật trạng thái kiểm định gần nhất vào Equipment
    equipment.lastInspectionDate = performedDate;
    equipment.nextInspectionDate = nextDueDate;
    equipment.lastInspectionResult = data.result || "pass";
    equipment.lastInspectionProvider = data.serviceProvider;
    if (data.reportFileUrl) {
      equipment.lastInspectionReportUrl = data.reportFileUrl;
      equipment.lastInspectionReportFileName = data.reportFileName;
    }

    await equipment.save();

    return {
      record: inspectionRecord,
      equipment,
    };
  },

  /**
   * Lấy lịch sử các đợt kiểm định của một thiết bị
   */
  listInspections: async (companyCode: string, equipmentId: string) => {
    return EquipmentInspectionModel.find({ companyCode, equipmentId })
      .sort({ performedDate: -1, createdAt: -1 })
      .lean();
  },

  /**
   * Xóa một bản ghi lịch sử kiểm định
   */
  deleteInspectionRecord: async (companyCode: string, equipmentId: string, recordId: string) => {
    const record = await EquipmentInspectionModel.findOneAndDelete({
      _id: recordId,
      companyCode,
      equipmentId,
    });

    if (!record) {
      throw new Error("Không tìm thấy bản ghi kiểm định.");
    }

    // Sau khi xóa, cập nhật lại trạng thái kiểm định mới nhất còn lại vào thiết bị
    const latestRecord = await EquipmentInspectionModel.findOne({ companyCode, equipmentId })
      .sort({ performedDate: -1, createdAt: -1 })
      .lean();

    const equipment = await EquipmentModel.findOne({ _id: equipmentId, companyCode });
    if (equipment) {
      if (latestRecord) {
        equipment.lastInspectionDate = latestRecord.performedDate;
        equipment.nextInspectionDate = latestRecord.nextDueDate;
        equipment.lastInspectionResult = latestRecord.result;
        equipment.lastInspectionProvider = latestRecord.serviceProvider;
        equipment.lastInspectionReportUrl = latestRecord.reportFileUrl;
        equipment.lastInspectionReportFileName = latestRecord.reportFileName;
      } else {
        equipment.lastInspectionDate = undefined;
        equipment.nextInspectionDate = undefined;
        equipment.lastInspectionResult = undefined;
        equipment.lastInspectionProvider = undefined;
        equipment.lastInspectionReportUrl = undefined;
        equipment.lastInspectionReportFileName = undefined;
      }
      await equipment.save();
    }

    return { success: true };
  },
};

