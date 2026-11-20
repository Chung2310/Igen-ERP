import { CategoryModel } from "../model/category.model";
import { SupplyModel } from "../model/supply.model";
import type { ICategory } from "../interface/category.interface";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const DEFAULT_CATEGORIES = [
  { code: "DM-BAO-HO", name: "Găng tay & Bảo hộ", color: "blue", description: "Găng tay cao su, khẩu trang, kính bảo hộ, áo choàng" },
  { code: "DM-KIM-TIEM", name: "Bơm kim tiêm & Dây truyền", color: "emerald", description: "Bơm tiêm các cỡ, kim luồn, dây truyền dịch, khóa ba chạc" },
  { code: "DM-BANG-GAC", name: "Băng gạc & Sát trùng", color: "amber", description: "Băng cuộn, gạc vô trùng, cồn đỏ, povidine, oxy già" },
  { code: "DM-CHI-PT", name: "Chỉ phẫu thuật & Dụng cụ", color: "rose", description: "Chỉ tự tiêu, chỉ nilon, dao mổ, kẹp phẫu thuật tiêu hao" },
  { code: "DM-DICH-TRUYEN", name: "Dịch truyền & Dược phẩm tiêu hao", color: "indigo", description: "Nước muối sinh lý, ringer lactate, glucose, dung dịch rửa" },
  { code: "DM-XET-NGHIEM", name: "Hóa chất & Thuốc thử xét nghiệm", color: "purple", description: "Ống nghiệm chân không, que thử, lam kính, đầu côn" },
];

export const categoryService = {
  async list(companyCode: string, query?: { search?: string; activeOnly?: boolean }) {
    await this.autoSeedCategories(companyCode);

    const filter: Record<string, any> = { companyCode };

    if (query?.activeOnly) {
      filter.isActive = true;
    }

    if (query?.search && query.search.trim()) {
      const s = escapeRegex(query.search.trim());
      filter.$or = [
        { name: { $regex: s, $options: "i" } },
        { code: { $regex: s, $options: "i" } },
        { description: { $regex: s, $options: "i" } },
      ];
    }

    const categories = await CategoryModel.find(filter)
      .sort({ name: 1, code: 1 })
      .lean();

    // Thống kê số lượng vật tư thuộc từng phân loại
    const counts = await SupplyModel.aggregate([
      { $match: { companyCode } },
      {
        $group: {
          _id: "$category",
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

    return categories.map((cat) => {
      const countByName = countMap.get((cat.name || "").trim().toLowerCase()) || 0;
      return {
        ...cat,
        supplyCount: countByName,
      };
    });
  },

  async getById(companyCode: string, id: string) {
    return CategoryModel.findOne({ _id: id, companyCode }).lean();
  },

  async create(companyCode: string, data: Partial<ICategory>) {
    const code = String(data.code || "").trim().toUpperCase();
    const name = String(data.name || "").trim();

    if (!code) throw new Error("Mã phân loại là bắt buộc.");
    if (!name) throw new Error("Tên phân loại là bắt buộc.");

    const existing = await CategoryModel.findOne({ companyCode, code }).lean();
    if (existing) {
      throw new Error(`Mã phân loại '${code}' đã tồn tại trong hệ thống.`);
    }

    const created = await CategoryModel.create({
      companyCode,
      code,
      name,
      description: data.description ? String(data.description).trim() : "",
      color: data.color ? String(data.color).trim() : "emerald",
      icon: data.icon ? String(data.icon).trim() : "",
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    });

    return created.toObject();
  },

  async update(companyCode: string, id: string, patch: Partial<ICategory>) {
    const category = await CategoryModel.findOne({ _id: id, companyCode });
    if (!category) {
      throw new Error("Không tìm thấy phân loại sản phẩm.");
    }

    if (patch.code) {
      const newCode = String(patch.code).trim().toUpperCase();
      if (newCode !== category.code) {
        const dup = await CategoryModel.findOne({ companyCode, code: newCode }).lean();
        if (dup) {
          throw new Error(`Mã phân loại '${newCode}' đã tồn tại trong hệ thống.`);
        }
        category.code = newCode;
      }
    }

    if (patch.name !== undefined) category.name = String(patch.name).trim();
    if (patch.description !== undefined) category.description = String(patch.description).trim();
    if (patch.color !== undefined) category.color = String(patch.color).trim();
    if (patch.icon !== undefined) category.icon = String(patch.icon).trim();
    if (patch.isActive !== undefined) category.isActive = Boolean(patch.isActive);

    await category.save();
    return category.toObject();
  },

  async delete(companyCode: string, id: string) {
    const category = await CategoryModel.findOne({ _id: id, companyCode });
    if (!category) {
      throw new Error("Không tìm thấy phân loại sản phẩm.");
    }

    const linkedSupply = await SupplyModel.findOne({
      companyCode,
      category: category.name,
    }).lean();

    if (linkedSupply) {
      throw new Error(
        `Không thể xóa phân loại '${category.name}' vì đang có vật tư thuộc phân loại này. Vui lòng tắt hoạt động thay vì xóa.`
      );
    }

    await CategoryModel.deleteOne({ _id: id, companyCode });
    return { success: true };
  },

  /**
   * Tự động khởi tạo danh sách Phân loại sản phẩm nếu cơ sở dữ liệu phân loại của công ty đang trống.
   */
  async autoSeedCategories(companyCode: string) {
    try {
      const count = await CategoryModel.countDocuments({ companyCode });
      if (count > 0) return;

      // Gom danh mục hiện có trong bảng Supply trước
      const rawCategories = await SupplyModel.distinct("category", {
        companyCode,
        category: { $exists: true, $ne: "" },
      });

      const uniqueNames = new Set<string>();
      const toInsert: any[] = [];

      if (rawCategories && rawCategories.length > 0) {
        rawCategories.forEach((rawName: string, index: number) => {
          const name = String(rawName).trim();
          if (!name || uniqueNames.has(name.toLowerCase())) return;
          uniqueNames.add(name.toLowerCase());

          const codeParts = name
            .split(/[\s,.-]+/)
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
          const code = `DM-${codeParts.slice(0, 6) || "CAT"}-${String(index + 1).padStart(2, "0")}`;

          toInsert.push({
            companyCode,
            code,
            name,
            description: `Phân loại ${name}`,
            color: "emerald",
            isActive: true,
          });
        });
      }

      // Thêm các danh mục mẫu mặc định y tế nếu chưa có
      DEFAULT_CATEGORIES.forEach((d) => {
        if (!uniqueNames.has(d.name.toLowerCase())) {
          uniqueNames.add(d.name.toLowerCase());
          toInsert.push({
            companyCode,
            ...d,
            isActive: true,
          });
        }
      });

      if (toInsert.length > 0) {
        await CategoryModel.insertMany(toInsert, { ordered: false }).catch(() => {});
      }
    } catch {
      // Bỏ qua lỗi auto-seed
    }
  },
};
