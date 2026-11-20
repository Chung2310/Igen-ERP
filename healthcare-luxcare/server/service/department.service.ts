import { DepartmentModel } from "../model/department.model";
import { EquipmentModel } from "../model/equipment.model";
import { UserModel } from "../model/user.model";
import { legacyDepartmentPattern } from './department-legacy-pattern';

export const departmentService = {
  async list(companyCode: string, query?: { search?: string; activeOnly?: boolean }) {
    const filter: Record<string, any> = { companyCode };
    if (query?.activeOnly) {
      filter.isActive = true;
    }
    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      filter.$or = [
        { name: { $regex: s, $options: "i" } },
        { code: { $regex: s, $options: "i" } },
      ];
    }

    const departments = await DepartmentModel.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    // Tính số lượng nhân viên của từng phòng ban chính xác
    const users = await UserModel.find({ companyCode })
      .select("_id departmentId department")
      .lean();

    const deptIdSet = new Set(departments.map((d) => d._id.toString()));
    const deptNameMap = new Map<string, string>();
    for (const d of departments) {
      deptNameMap.set(d.name.trim().toLowerCase(), d._id.toString());
    }

    const countMap = new Map<string, number>();
    for (const u of users) {
      let matchedDeptId: string | undefined;
      const uDeptId = u.departmentId ? String(u.departmentId).trim() : "";
      const uDeptName = u.department ? String(u.department).trim().toLowerCase() : "";

      if (uDeptId && deptIdSet.has(uDeptId)) {
        matchedDeptId = uDeptId;
      } else if (uDeptName && deptNameMap.has(uDeptName)) {
        matchedDeptId = deptNameMap.get(uDeptName);
      }

      if (matchedDeptId) {
        countMap.set(matchedDeptId, (countMap.get(matchedDeptId) || 0) + 1);
      }
    }

    return departments.map((dept) => ({
      ...dept,
      employeeCount: countMap.get(dept._id.toString()) || 0,
    }));
  },

  async getById(companyCode: string, id: string) {
    return DepartmentModel.findOne({ _id: id, companyCode }).lean();
  },

  async create(companyCode: string, data: {
    code: string;
    name: string;
    description?: string;
    managerUid?: string;
    managerName?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const code = String(data.code || "").trim().toUpperCase();
    const name = String(data.name || "").trim();

    if (!code || !name) {
      throw new Error("Mã và tên phòng ban là bắt buộc.");
    }

    const existingCode = await DepartmentModel.findOne({ companyCode, code }).lean();
    if (existingCode) {
      throw new Error(`Mã phòng ban "${code}" đã tồn tại trong doanh nghiệp.`);
    }

    const existingName = await DepartmentModel.findOne({ companyCode, name }).lean();
    if (existingName) {
      throw new Error(`Tên phòng ban "${name}" đã tồn tại trong doanh nghiệp.`);
    }

    return DepartmentModel.create({
      companyCode,
      code,
      name,
      description: data.description?.trim() || "",
      managerUid: data.managerUid?.trim() || "",
      managerName: data.managerName?.trim() || "",
      sortOrder: Number(data.sortOrder) || 0,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    });
  },

  async update(companyCode: string, id: string, data: {
    code?: string;
    name?: string;
    description?: string;
    managerUid?: string;
    managerName?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const existing = await DepartmentModel.findOne({ _id: id, companyCode });
    if (!existing) {
      throw new Error("Không tìm thấy phòng ban.");
    }

    const updates: Record<string, any> = {};

    if (data.code !== undefined) {
      const code = String(data.code).trim().toUpperCase();
      if (!code) throw new Error("Mã phòng ban không được để trống.");
      if (code !== existing.code) {
        const dup = await DepartmentModel.findOne({ companyCode, code, _id: { $ne: id } }).lean();
        if (dup) throw new Error(`Mã phòng ban "${code}" đã được sử dụng.`);
        updates.code = code;
      }
    }

    const oldName = existing.name;
    let nameChanged = false;
    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) throw new Error("Tên phòng ban không được để trống.");
      if (name !== existing.name) {
        const dup = await DepartmentModel.findOne({ companyCode, name, _id: { $ne: id } }).lean();
        if (dup) throw new Error(`Tên phòng ban "${name}" đã được sử dụng.`);
        updates.name = name;
        nameChanged = true;
      }
    }

    if (data.description !== undefined) updates.description = String(data.description).trim();
    if (data.managerUid !== undefined) updates.managerUid = String(data.managerUid).trim();
    if (data.managerName !== undefined) updates.managerName = String(data.managerName).trim();
    if (data.sortOrder !== undefined) updates.sortOrder = Number(data.sortOrder) || 0;
    if (data.isActive !== undefined) updates.isActive = Boolean(data.isActive);

    const updated = await DepartmentModel.findOneAndUpdate(
      { _id: id, companyCode },
      { $set: updates },
      { returnDocument: "after", runValidators: true }
    ).lean();

    // Nếu đổi tên: tự động cập nhật trường department cho tất cả người dùng thuộc departmentId này
    if (nameChanged && updates.name) {
      await UserModel.updateMany(
        { companyCode, departmentId: id },
        { $set: { department: updates.name } }
      );
    }

    if (nameChanged && updates.name) {
      await EquipmentModel.updateMany({ companyCode, departmentId: id }, { $set: { departmentName: updates.name } });
    }
    return updated;
  },

  async delete(companyCode: string, id: string) {
    const dept = await DepartmentModel.findOne({ _id: id, companyCode }).lean();
    if (!dept) {
      throw new Error("Không tìm thấy phòng ban.");
    }

    // Kiểm tra xem có nhân sự đang thuộc phòng ban này không (theo departmentId hoặc name)
    const inUseCount = await UserModel.countDocuments({
      companyCode,
      $or: [{ departmentId: id }, { department: dept.name }],
    });

    if (inUseCount > 0) {
      throw new Error(
        `Phòng ban đang có ${inUseCount} nhân sự sử dụng. Vui lòng chuyển nhân sự sang phòng ban khác hoặc chuyển trạng thái sang "Ngừng sử dụng".`
      );
    }

    const equipmentCount = await EquipmentModel.countDocuments({ companyCode, departmentId: id });
    if (equipmentCount > 0) throw new Error(`Phòng ban đang gắn với ${equipmentCount} thiết bị. Vui lòng chuyển thiết bị sang phòng ban khác trước khi xóa.`);
    await DepartmentModel.deleteOne({ _id: id, companyCode });
    return { success: true, message: "Đã xóa phòng ban thành công." };
  },

  /**
   * Chuẩn hóa dữ liệu cũ:
   * Chuyển các chuỗi text tự do trong hồ sơ nhân viên cũ về phòng ban chuẩn
   */
  async mergeLegacy(companyCode: string, sourceTexts: string[], targetDepartmentId: string) {
    const targetDept = await DepartmentModel.findOne({ _id: targetDepartmentId, companyCode }).lean();
    if (!targetDept) {
      throw new Error("Phòng ban chuẩn đích không tồn tại.");
    }

    const cleanSources = sourceTexts.map((s) => s.trim()).filter(Boolean);
    if (cleanSources.length === 0) {
      throw new Error("Vui lòng cung cấp danh sách tên phòng ban cũ cần chuẩn hóa.");
    }

    const result = await UserModel.updateMany(
      {
        companyCode,
        $or: [
          { department: { $in: cleanSources } },
          { department: { $regex: legacyDepartmentPattern(cleanSources), $options: "i" } },
        ],
      },
      {
        $set: {
          departmentId: targetDept._id.toString(),
          department: targetDept.name,
        },
      }
    );

    return {
      modifiedCount: result.modifiedCount,
      targetDepartment: targetDept,
    };
  },

  /**
   * Lấy danh sách các giá trị text phòng ban cũ chưa được gắn departmentId chuẩn
   */
  async getUnmappedLegacyDepartments(companyCode: string) {
    const users = await UserModel.find(
      { companyCode, department: { $exists: true, $ne: "" }, departmentId: { $in: ["", null, undefined] } },
      { department: 1 }
    ).lean();

    const standardDepts = await DepartmentModel.find({ companyCode }, { name: 1 }).lean();
    const standardNames = new Set(standardDepts.map((d) => d.name.toLowerCase()));

    const legacyMap = new Map<string, number>();
    for (const u of users) {
      const name = (u.department || "").trim();
      if (!name) continue;
      if (!standardNames.has(name.toLowerCase())) {
        legacyMap.set(name, (legacyMap.get(name) || 0) + 1);
      }
    }

    return Array.from(legacyMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  },
};
