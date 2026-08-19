import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CustomerSettingsService, DEFAULT_CUSTOMER_TIERS } from "./customer-settings.service";
import { CustomerSettingsModel } from "../models/customer-settings.model";

describe("CustomerSettingsService", () => {
  let replSet: MongoMemoryReplSet;
  const companyCode = "TEST-CO";

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
  });

  beforeEach(async () => {
    await CustomerSettingsModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  describe("getSettings", () => {
    it("trả về phân hạng mặc định nếu công ty chưa có cấu hình", async () => {
      const settings = await CustomerSettingsService.getSettings(companyCode);
      expect(settings.companyCode).toBe(companyCode);
      expect(settings.customerTiers).toEqual(DEFAULT_CUSTOMER_TIERS);
    });

    it("trả về cấu hình đã được lưu trong database", async () => {
      const customTiers = [
        { code: "standard", name: "Thành viên", minSpend: 0 },
        { code: "vip", name: "Khách VIP", minSpend: 10_000_000 },
      ];

      await CustomerSettingsModel.create({
        companyCode,
        customerTiers: customTiers,
      });

      const settings = await CustomerSettingsService.getSettings(companyCode);
      expect(settings.companyCode).toBe(companyCode);
      expect(settings.customerTiers).toMatchObject(customTiers);
    });
  });

  describe("updateSettings", () => {
    it("lưu và cập nhật thành công cấu hình phân hạng hợp lệ", async () => {
      const customTiers = [
        { code: "standard", name: "Thành viên", minSpend: 0 },
        { code: "vip", name: "Khách VIP", minSpend: 10_000_000 },
      ];

      const result = await CustomerSettingsService.updateSettings(companyCode, customTiers);
      expect(result.companyCode).toBe(companyCode);
      expect(result.customerTiers).toMatchObject(customTiers);

      const dbRecord = await CustomerSettingsModel.findOne({ companyCode }).lean();
      expect(dbRecord?.customerTiers).toMatchObject(customTiers);
    });

    it("ném lỗi nếu danh sách phân hạng rỗng", async () => {
      await expect(
        CustomerSettingsService.updateSettings(companyCode, [])
      ).rejects.toThrow("Danh sách phân hạng không được để trống.");
    });

    it("ném lỗi nếu hạng thấp nhất có chi tiêu khởi đầu khác 0", async () => {
      const invalidTiers = [
        { code: "standard", name: "Thành viên", minSpend: 1000 },
      ];
      await expect(
        CustomerSettingsService.updateSettings(companyCode, invalidTiers)
      ).rejects.toThrow("Hạng thấp nhất phải có mức chi tiêu bắt đầu từ 0.");
    });

    it("ném lỗi nếu mã hạng chứa ký tự không hợp lệ", async () => {
      const invalidTiers = [
        { code: "Standard!", name: "Thành viên", minSpend: 0 },
      ];
      await expect(
        CustomerSettingsService.updateSettings(companyCode, invalidTiers)
      ).rejects.toThrow("Mã hạng 'Standard!' không hợp lệ.");
    });

    it("ném lỗi nếu các mốc chi tiêu tiếp theo nhỏ hơn hoặc bằng mốc trước đó", async () => {
      const invalidTiers = [
        { code: "standard", name: "Thành viên", minSpend: 0 },
        { code: "silver", name: "Bạc", minSpend: 5_000_000 },
        { code: "gold", name: "Vàng", minSpend: 5_000_000 }, // Trùng mốc chi tiêu
      ];
      await expect(
        CustomerSettingsService.updateSettings(companyCode, invalidTiers)
      ).rejects.toThrow("Mức chi tiêu tối thiểu của các hạng tiếp theo phải lớn hơn hạng trước đó.");
    });

    it("ném lỗi nếu trùng mã hạng", async () => {
      const invalidTiers = [
        { code: "standard", name: "Thành viên", minSpend: 0 },
        { code: "standard", name: "Thành viên khác", minSpend: 5_000_000 },
      ];
      await expect(
        CustomerSettingsService.updateSettings(companyCode, invalidTiers)
      ).rejects.toThrow("Mã hạng 'standard' bị trùng lặp.");
    });

    it("ném lỗi nếu trùng tên hạng", async () => {
      const invalidTiers = [
        { code: "standard", name: "Thành viên", minSpend: 0 },
        { code: "vip", name: "Thành viên", minSpend: 5_000_000 },
      ];
      await expect(
        CustomerSettingsService.updateSettings(companyCode, invalidTiers)
      ).rejects.toThrow("Tên hạng 'Thành viên' bị trùng lặp.");
    });
  });
});
