import { RoomModel } from "../model/room.model";
import { EquipmentModel } from "../model/equipment.model";
import type { RoomType } from "../interface/room.interface";

export const roomService = {
  async list(companyCode: string, query?: { branchId?: string; search?: string; activeOnly?: boolean; type?: string }) {
    const filter: Record<string, any> = { companyCode };

    if (query?.branchId && query.branchId.trim()) {
      filter.branchId = query.branchId.trim();
    }
    if (query?.activeOnly) {
      filter.isActive = true;
    }
    if (query?.type && query.type.trim()) {
      filter.type = query.type.trim();
    }
    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      filter.$or = [
        { name: { $regex: s, $options: "i" } },
        { code: { $regex: s, $options: "i" } },
        { floor: { $regex: s, $options: "i" } },
      ];
    }

    const rooms = await RoomModel.find(filter)
      .sort({ sortOrder: 1, code: 1, name: 1 })
      .lean();

    // Tính số lượng thiết bị của từng phòng
    const counts = await EquipmentModel.aggregate([
      { $match: { companyCode, ...(query?.branchId ? { branchId: query.branchId.trim() } : {}) } },
      {
        $group: {
          _id: { $ifNull: ["$roomId", "$location"] },
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map<string, number>();
    for (const c of counts) {
      if (c._id) {
        countMap.set(String(c._id), c.count);
      }
    }

    return rooms.map((room) => {
      const roomId = room._id.toString();
      const countById = countMap.get(roomId) || 0;
      const countByName = countMap.get(room.name) || 0;
      const equipmentCount = Math.max(countById, countByName);
      return {
        ...room,
        equipmentCount,
      };
    });
  },

  async getById(companyCode: string, id: string) {
    return RoomModel.findOne({ _id: id, companyCode }).lean();
  },

  async create(companyCode: string, data: {
    branchId: string;
    code: string;
    name: string;
    type?: RoomType;
    floor?: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const branchId = String(data.branchId || "").trim();
    const code = String(data.code || "").trim().toUpperCase();
    const name = String(data.name || "").trim();

    if (!branchId) throw new Error("Chi nhánh là bắt buộc.");
    if (!code || !name) throw new Error("Mã và tên phòng là bắt buộc.");

    const existing = await RoomModel.findOne({ companyCode, branchId, code }).lean();
    if (existing) {
      throw new Error(`Mã phòng "${code}" đã tồn tại trong chi nhánh này.`);
    }

    return RoomModel.create({
      companyCode,
      branchId,
      code,
      name,
      type: data.type || "other",
      floor: data.floor?.trim() || "",
      description: data.description?.trim() || "",
      sortOrder: Number(data.sortOrder) || 0,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    });
  },

  async update(companyCode: string, id: string, data: {
    code?: string;
    name?: string;
    type?: RoomType;
    floor?: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const existing = await RoomModel.findOne({ _id: id, companyCode });
    if (!existing) {
      throw new Error("Không tìm thấy thông tin phòng.");
    }

    const updates: Record<string, any> = {};

    if (data.code !== undefined) {
      const code = String(data.code).trim().toUpperCase();
      if (!code) throw new Error("Mã phòng không được để trống.");
      if (code !== existing.code) {
        const dup = await RoomModel.findOne({
          companyCode,
          branchId: existing.branchId,
          code,
          _id: { $ne: id },
        }).lean();
        if (dup) throw new Error(`Mã phòng "${code}" đã được sử dụng trong chi nhánh này.`);
        updates.code = code;
      }
    }

    let nameChanged = false;
    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) throw new Error("Tên phòng không được để trống.");
      if (name !== existing.name) {
        updates.name = name;
        nameChanged = true;
      }
    }

    if (data.type !== undefined) updates.type = data.type;
    if (data.floor !== undefined) updates.floor = String(data.floor).trim();
    if (data.description !== undefined) updates.description = String(data.description).trim();
    if (data.sortOrder !== undefined) updates.sortOrder = Number(data.sortOrder) || 0;
    if (data.isActive !== undefined) updates.isActive = Boolean(data.isActive);

    const updated = await RoomModel.findOneAndUpdate(
      { _id: id, companyCode },
      { $set: updates },
      { returnDocument: "after", runValidators: true }
    ).lean();

    // Nếu đổi tên: tự động cập nhật trường location cho các thiết bị thuộc roomId này
    if (nameChanged && updates.name) {
      await EquipmentModel.updateMany(
        { companyCode, roomId: id },
        { $set: { location: updates.name } }
      );
    }

    return updated;
  },

  async delete(companyCode: string, id: string) {
    const room = await RoomModel.findOne({ _id: id, companyCode }).lean();
    if (!room) {
      throw new Error("Không tìm thấy thông tin phòng.");
    }

    // Kiểm tra xem phòng có thiết bị nào đang đặt không
    const inUseCount = await EquipmentModel.countDocuments({
      companyCode,
      branchId: room.branchId,
      $or: [{ roomId: id }, { location: room.name }],
    });

    if (inUseCount > 0) {
      throw new Error(
        `Phòng đang có ${inUseCount} thiết bị sử dụng vị trí này. Vui lòng chuyển thiết bị sang phòng khác hoặc chuyển trạng thái sang "Ngừng sử dụng".`
      );
    }

    await RoomModel.deleteOne({ _id: id, companyCode });
    return { success: true, message: "Đã xóa phòng thành công." };
  },

  /**
   * Chuẩn hóa vị trí thiết bị cũ sang phòng chuẩn
   */
  async mergeLegacy(companyCode: string, branchId: string, sourceTexts: string[], targetRoomId: string) {
    const targetRoom = await RoomModel.findOne({ _id: targetRoomId, companyCode, branchId }).lean();
    if (!targetRoom) {
      throw new Error("Phòng chuẩn đích không tồn tại trong chi nhánh này.");
    }

    const cleanSources = sourceTexts.map((s) => s.trim()).filter(Boolean);
    if (cleanSources.length === 0) {
      throw new Error("Vui lòng cung cấp danh sách tên vị trí cũ cần chuẩn hóa.");
    }

    const result = await EquipmentModel.updateMany(
      {
        companyCode,
        branchId,
        $or: [
          { location: { $in: cleanSources } },
          { location: { $regex: cleanSources.map((s) => `^${s}$`).join("|"), $options: "i" } },
        ],
      },
      {
        $set: {
          roomId: targetRoom._id.toString(),
          location: targetRoom.name,
        },
      }
    );

    return {
      modifiedCount: result.modifiedCount,
      targetRoom,
    };
  },

  /**
   * Lấy danh sách các text vị trí thiết bị cũ chưa gắn roomId chuẩn theo branch
   */
  async getUnmappedLegacyLocations(companyCode: string, branchId: string) {
    const equipments = await EquipmentModel.find(
      { companyCode, branchId, location: { $exists: true, $ne: "" }, roomId: { $in: ["", null, undefined] } },
      { location: 1 }
    ).lean();

    const standardRooms = await RoomModel.find({ companyCode, branchId }, { name: 1 }).lean();
    const standardNames = new Set(standardRooms.map((r) => r.name.toLowerCase()));

    const legacyMap = new Map<string, number>();
    for (const eq of equipments) {
      const loc = (eq.location || "").trim();
      if (!loc) continue;
      if (!standardNames.has(loc.toLowerCase())) {
        legacyMap.set(loc, (legacyMap.get(loc) || 0) + 1);
      }
    }

    return Array.from(legacyMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));
  },
};
