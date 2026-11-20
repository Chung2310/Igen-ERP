import { SupplierModel } from "../model/supplier.model";
import { SupplyModel } from "../model/supply.model";
import type { ISupplier } from "../interface/supplier.interface";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const supplierService = {
  async list(companyCode: string, query?: { search?: string; activeOnly?: boolean }) {
    // Tự động gom các nhà cung cấp cũ từ bảng Supply nếu bảng Supplier chưa có dữ liệu
    await this.autoSeedFromExistingSupplies(companyCode);

    const filter: Record<string, any> = { companyCode };

    if (query?.activeOnly) {
      filter.isActive = true;
    }

    if (query?.search && query.search.trim()) {
      const s = escapeRegex(query.search.trim());
      filter.$or = [
        { name: { $regex: s, $options: "i" } },
        { code: { $regex: s, $options: "i" } },
        { shortName: { $regex: s, $options: "i" } },
        { contactPerson: { $regex: s, $options: "i" } },
        { phone: { $regex: s, $options: "i" } },
        { taxCode: { $regex: s, $options: "i" } },
      ];
    }

    const suppliers = await SupplierModel.find(filter)
      .sort({ name: 1, code: 1 })
      .lean();

    // Thống kê số lượng vật tư liên kết
    const counts = await SupplyModel.aggregate([
      { $match: { companyCode } },
      {
        $group: {
          _id: { $ifNull: ["$supplierId", "$supplier"] },
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

    return suppliers.map((sup) => {
      const supId = sup._id.toString();
      const countById = countMap.get(supId.toLowerCase()) || 0;
      const countByName = countMap.get((sup.name || "").trim().toLowerCase()) || 0;
      const countByShortName = sup.shortName ? (countMap.get(sup.shortName.trim().toLowerCase()) || 0) : 0;
      const supplyCount = Math.max(countById, countByName, countByShortName);

      return {
        ...sup,
        supplyCount,
      };
    });
  },

  async getById(companyCode: string, id: string) {
    return SupplierModel.findOne({ _id: id, companyCode }).lean();
  },

  async create(companyCode: string, data: Partial<ISupplier>) {
    const code = String(data.code || "").trim().toUpperCase();
    const name = String(data.name || "").trim();

    if (!code) throw new Error("Mã nhà cung cấp là bắt buộc.");
    if (!name) throw new Error("Tên nhà cung cấp là bắt buộc.");

    const existing = await SupplierModel.findOne({ companyCode, code }).lean();
    if (existing) {
      throw new Error(`Mã nhà cung cấp '${code}' đã tồn tại trong hệ thống.`);
    }

    const created = await SupplierModel.create({
      companyCode,
      code,
      name,
      shortName: data.shortName ? String(data.shortName).trim() : "",
      contactPerson: data.contactPerson ? String(data.contactPerson).trim() : "",
      phone: data.phone ? String(data.phone).trim() : "",
      email: data.email ? String(data.email).trim().toLowerCase() : "",
      address: data.address ? String(data.address).trim() : "",
      taxCode: data.taxCode ? String(data.taxCode).trim() : "",
      notes: data.notes ? String(data.notes).trim() : "",
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    });

    return created.toObject();
  },

  async update(companyCode: string, id: string, patch: Partial<ISupplier>) {
    const supplier = await SupplierModel.findOne({ _id: id, companyCode });
    if (!supplier) {
      throw new Error("Không tìm thấy nhà cung cấp.");
    }

    if (patch.code) {
      const newCode = String(patch.code).trim().toUpperCase();
      if (newCode !== supplier.code) {
        const dup = await SupplierModel.findOne({ companyCode, code: newCode }).lean();
        if (dup) {
          throw new Error(`Mã nhà cung cấp '${newCode}' đã tồn tại trong hệ thống.`);
        }
        supplier.code = newCode;
      }
    }

    if (patch.name !== undefined) supplier.name = String(patch.name).trim();
    if (patch.shortName !== undefined) supplier.shortName = String(patch.shortName).trim();
    if (patch.contactPerson !== undefined) supplier.contactPerson = String(patch.contactPerson).trim();
    if (patch.phone !== undefined) supplier.phone = String(patch.phone).trim();
    if (patch.email !== undefined) supplier.email = String(patch.email).trim().toLowerCase();
    if (patch.address !== undefined) supplier.address = String(patch.address).trim();
    if (patch.taxCode !== undefined) supplier.taxCode = String(patch.taxCode).trim();
    if (patch.notes !== undefined) supplier.notes = String(patch.notes).trim();
    if (patch.isActive !== undefined) supplier.isActive = Boolean(patch.isActive);

    await supplier.save();
    return supplier.toObject();
  },

  async delete(companyCode: string, id: string) {
    const supplier = await SupplierModel.findOne({ _id: id, companyCode });
    if (!supplier) {
      throw new Error("Không tìm thấy nhà cung cấp.");
    }

    // Kiểm tra có vật tư nào đang dùng không
    const linkedSupply = await SupplyModel.findOne({
      companyCode,
      $or: [
        { supplierId: id },
        { supplier: supplier.name },
      ],
    }).lean();

    if (linkedSupply) {
      throw new Error(
        `Không thể xóa nhà cung cấp '${supplier.name}' vì đang có vật tư y tế liên kết. Vui lòng tắt hoạt động thay vì xóa.`
      );
    }

    await SupplierModel.deleteOne({ _id: id, companyCode });
    return { success: true };
  },

  /**
   * Tự động khởi tạo danh sách Nhà cung cấp từ các tên nhà cung cấp đã có trong Supply
   * nếu cơ sở dữ liệu Supplier của công ty đang trống.
   */
  async autoSeedFromExistingSupplies(companyCode: string) {
    try {
      const count = await SupplierModel.countDocuments({ companyCode });
      if (count > 0) return;

      const rawSuppliers = await SupplyModel.distinct("supplier", {
        companyCode,
        supplier: { $exists: true, $ne: "" },
      });

      if (!rawSuppliers || rawSuppliers.length === 0) return;

      const toInsert = rawSuppliers
        .map((rawName: string, index: number) => {
          const name = String(rawName).trim();
          if (!name) return null;
          // Tạo mã NCC từ chữ cái đầu hoặc số
          const codeParts = name
            .split(/[\s,.-]+/)
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
          const code = `NCC-${codeParts.slice(0, 6) || "SUP"}-${String(index + 1).padStart(2, "0")}`;
          return {
            companyCode,
            code,
            name,
            shortName: name.length > 20 ? name.split(" ")[0] : name,
            isActive: true,
          };
        })
        .filter(Boolean);

      if (toInsert.length > 0) {
        await SupplierModel.insertMany(toInsert, { ordered: false }).catch(() => {});
      }
    } catch {
      // Bỏ qua lỗi auto-seed nếu có conflict
    }
  },
};
