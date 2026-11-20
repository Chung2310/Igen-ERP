import { SupplyInventoryConfigModel } from "../model/supply-inventory.model";
import { WarehouseModel } from "../model/warehouse.model";
import { SupplyModel } from "../model/supply.model";
import type { IWarehouse } from "../interface/warehouse.interface";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const warehouseService = {
  async list(
    companyCode: string,
    query?: { branchId?: string; search?: string; activeOnly?: boolean }
  ) {
    await this.autoSeedFromExistingSupplies(companyCode, query?.branchId);

    const filter: Record<string, any> = { companyCode };

    if (query?.branchId && query.branchId.trim()) {
      filter.$or = [
        { branchId: query.branchId.trim() },
        { branchId: { $in: ["", null] } },
      ];
    }

    if (query?.activeOnly) {
      filter.isActive = true;
    }

    if (query?.search && query.search.trim()) {
      const s = escapeRegex(query.search.trim());
      const searchConditions = [
        { name: { $regex: s, $options: "i" } },
        { code: { $regex: s, $options: "i" } },
        { location: { $regex: s, $options: "i" } },
        { managerName: { $regex: s, $options: "i" } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const warehouses = await WarehouseModel.find(filter)
      .sort({ name: 1, code: 1 })
      .lean();

    // Thống kê số lượng vật tư liên kết
    const counts = await SupplyModel.aggregate([
      { $match: { companyCode, ...(query?.branchId ? { branchId: query.branchId } : {}) } },
      {
        $group: {
          _id: { $ifNull: ["$warehouseId", "$warehouseLocation"] },
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map<string, number>();
    for (const c of counts) {
      if (c._id) {
        countMap.set(String(c._id).trim().toLowerCase(), c.count);
      }
    }

    return warehouses.map((wh) => {
      const whId = wh._id.toString();
      const countById = countMap.get(whId.toLowerCase()) || 0;
      const countByName = countMap.get((wh.name || "").trim().toLowerCase()) || 0;
      const supplyCount = Math.max(countById, countByName);

      return {
        ...wh,
        supplyCount,
      };
    });
  },

  async getById(companyCode: string, id: string) {
    return WarehouseModel.findOne({ _id: id, companyCode }).lean();
  },

  async create(companyCode: string, data: Partial<IWarehouse>) {
    const code = String(data.code || "").trim().toUpperCase();
    const name = String(data.name || "").trim();
    const branchId = data.branchId ? String(data.branchId).trim() : "";

    if (!code) throw new Error("Mã kho là bắt buộc.");
    if (!name) throw new Error("Tên kho là bắt buộc.");

    const existing = await WarehouseModel.findOne({
      companyCode,
      branchId,
      code,
    }).lean();
    if (existing) {
      throw new Error(`Mã kho '${code}' đã tồn tại trong chi nhánh này.`);
    }

    const created = await WarehouseModel.create({
      companyCode,
      branchId,
      code,
      name,
      location: data.location ? String(data.location).trim() : "",
      managerName: data.managerName ? String(data.managerName).trim() : "",
      managerPhone: data.managerPhone ? String(data.managerPhone).trim() : "",
      description: data.description ? String(data.description).trim() : "",
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    });

    return created.toObject();
  },

  async update(companyCode: string, id: string, patch: Partial<IWarehouse>) {
    const mode = await SupplyInventoryConfigModel.findOne({ companyCode }).lean();
    if (mode && mode.mode !== "legacy") throw new Error("Kho đang chuyển dữ liệu hoặc dùng V2; không sửa cấu trúc kho qua chức năng cũ.");
    const warehouse = await WarehouseModel.findOne({ _id: id, companyCode });
    if (!warehouse) {
      throw new Error("Không tìm thấy kho lưu trữ.");
    }

    const targetBranchId = patch.branchId !== undefined ? String(patch.branchId).trim() : warehouse.branchId;

    if (patch.code) {
      const newCode = String(patch.code).trim().toUpperCase();
      if (newCode !== warehouse.code || targetBranchId !== warehouse.branchId) {
        const dup = await WarehouseModel.findOne({
          companyCode,
          branchId: targetBranchId,
          code: newCode,
        }).lean();
        if (dup && String(dup._id) !== id) {
          throw new Error(`Mã kho '${newCode}' đã tồn tại trong chi nhánh này.`);
        }
        warehouse.code = newCode;
      }
    }

    if (patch.branchId !== undefined) warehouse.branchId = targetBranchId;
    if (patch.name !== undefined) warehouse.name = String(patch.name).trim();
    if (patch.location !== undefined) warehouse.location = String(patch.location).trim();
    if (patch.managerName !== undefined) warehouse.managerName = String(patch.managerName).trim();
    if (patch.managerPhone !== undefined) warehouse.managerPhone = String(patch.managerPhone).trim();
    if (patch.description !== undefined) warehouse.description = String(patch.description).trim();
    if (patch.isActive !== undefined) warehouse.isActive = Boolean(patch.isActive);

    await warehouse.save();
    return warehouse.toObject();
  },

  async delete(companyCode: string, id: string) {
    const mode = await SupplyInventoryConfigModel.findOne({ companyCode }).lean();
    if (mode && mode.mode !== "legacy") throw new Error("Không xóa kho trong lúc chuyển dữ liệu hoặc khi đã dùng kho V2.");
    const warehouse = await WarehouseModel.findOne({ _id: id, companyCode });
    if (!warehouse) {
      throw new Error("Không tìm thấy kho lưu trữ.");
    }

    const linkedSupply = await SupplyModel.findOne({
      companyCode,
      $or: [
        { warehouseId: id },
        { warehouseLocation: warehouse.name },
      ],
    }).lean();

    if (linkedSupply) {
      throw new Error(
        `Không thể xóa kho '${warehouse.name}' vì đang có vật tư lưu trữ tại đây. Vui lòng tắt hoạt động thay vì xóa.`
      );
    }

    await WarehouseModel.deleteOne({ _id: id, companyCode });
    return { success: true };
  },

  /**
   * Tự động khởi tạo danh mục Kho từ các vị trí kho đã có trong Supply nếu bảng Warehouse đang trống.
   */
  async autoSeedFromExistingSupplies(companyCode: string, branchId?: string) {
    try {
      const count = await WarehouseModel.countDocuments({ companyCode });
      if (count > 0) return;

      const rawLocations = await SupplyModel.distinct("warehouseLocation", {
        companyCode,
        warehouseLocation: { $exists: true, $ne: "" },
      });

      if (!rawLocations || rawLocations.length === 0) return;

      const toInsert = rawLocations
        .map((rawName: string, index: number) => {
          const name = String(rawName).trim();
          if (!name) return null;
          const codeParts = name
            .split(/[\s,.-]+/)
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
          const code = `KHO-${codeParts.slice(0, 6) || "LOC"}-${String(index + 1).padStart(2, "0")}`;
          return {
            companyCode,
            branchId: branchId || "",
            code,
            name,
            location: name,
            isActive: true,
          };
        })
        .filter(Boolean);

      if (toInsert.length > 0) {
        await WarehouseModel.insertMany(toInsert, { ordered: false }).catch(() => {});
      }
    } catch {
      // Bỏ qua lỗi auto-seed
    }
  },
};
