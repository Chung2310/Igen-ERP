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
        { code: "standard", name: "Thành viên", minGrossProfit: 0 },
        { code: "vip", name: "Khách VIP", minGrossProfit: 10_000_000 },
      ];

      await CustomerSettingsModel.create({
        companyCode,
        customerTiers: customTiers,
      });

      const settings = await CustomerSettingsService.getSettings(companyCode);
      expect(settings.companyCode).toBe(companyCode);
      expect(settings.customerTiers).toMatchObject(customTiers);
    });

    it("ignores a legacy sales metric and exposes legacy thresholds as profit thresholds", async () => {
      await CustomerSettingsModel.collection.insertOne({
        companyCode,
        tierEvaluationMetric: "sales",
        customerTiers: [
          { code: "standard", name: "Thành viên", minSpend: 0 },
          { code: "vip", name: "Khách VIP", minSpend: 5_000_000 },
        ],
      });

      const settings = await CustomerSettingsService.getSettings(companyCode);
      expect(settings.tierEvaluationMetric).toBe("gross_profit");
      expect(settings.customerTiers[1].minGrossProfit).toBe(5_000_000);
    });
  });

  describe("updateSettings", () => {
    it("lưu và cập nhật thành công cấu hình phân hạng hợp lệ", async () => {
      const customTiers = [
        { code: "standard", name: "Thành viên", minGrossProfit: 0 },
        { code: "vip", name: "Khách VIP", minGrossProfit: 10_000_000 },
      ];

      const result = await CustomerSettingsService.updateSettings(companyCode, customTiers);
      expect(result.companyCode).toBe(companyCode);
      expect(result.customerTiers).toMatchObject(customTiers);
      expect(result.tierEvaluationMetric).toBe("gross_profit");

      const dbRecord = await CustomerSettingsModel.findOne({ companyCode }).lean();
      expect(dbRecord?.customerTiers).toMatchObject(customTiers);
      expect(dbRecord?.tierEvaluationMetric).toBe("gross_profit");
    });

    it("converts legacy minSpend thresholds into profit thresholds", async () => {
      const result = await CustomerSettingsService.updateSettings(companyCode, [
        { code: "standard", name: "Thành viên", minSpend: 0 },
        { code: "vip", name: "Khách VIP", minSpend: 8_000_000 },
      ]);
      expect(result.customerTiers?.[1].minGrossProfit).toBe(8_000_000);
    });

    it("ném lỗi nếu danh sách phân hạng rỗng", async () => {
      await expect(
        CustomerSettingsService.updateSettings(companyCode, [])
      ).rejects.toThrow("Danh sách phân hạng không được để trống.");
    });

    it("ném lỗi nếu hạng thấp nhất có ngưỡng lợi nhuận gộp khác 0", async () => {
      const invalidTiers = [
        { code: "standard", name: "Thành viên", minGrossProfit: 1000 },
      ];
      await expect(
        CustomerSettingsService.updateSettings(companyCode, invalidTiers)
      ).rejects.toThrow("Hạng thấp nhất phải có ngưỡng lợi nhuận gộp bắt đầu từ 0.");
    });

    it("ném lỗi nếu mã hạng chứa ký tự không hợp lệ", async () => {
      const invalidTiers = [
        { code: "Standard!", name: "Thành viên", minGrossProfit: 0 },
      ];
      await expect(
        CustomerSettingsService.updateSettings(companyCode, invalidTiers)
      ).rejects.toThrow("Mã hạng 'Standard!' không hợp lệ.");
    });

    it("ném lỗi nếu các ngưỡng lợi nhuận gộp tiếp theo nhỏ hơn hoặc bằng mốc trước đó", async () => {
      const invalidTiers = [
        { code: "standard", name: "Thành viên", minGrossProfit: 0 },
        { code: "silver", name: "Bạc", minGrossProfit: 5_000_000 },
        { code: "gold", name: "Vàng", minGrossProfit: 5_000_000 }, // Trùng ngưỡng lợi nhuận gộp
      ];
      await expect(
        CustomerSettingsService.updateSettings(companyCode, invalidTiers)
      ).rejects.toThrow("Ngưỡng lợi nhuận gộp của các hạng tiếp theo phải lớn hơn hạng trước đó.");
    });

    it("ném lỗi nếu trùng mã hạng", async () => {
      const invalidTiers = [
        { code: "standard", name: "Thành viên", minGrossProfit: 0 },
        { code: "standard", name: "Thành viên khác", minGrossProfit: 5_000_000 },
      ];
      await expect(
        CustomerSettingsService.updateSettings(companyCode, invalidTiers)
      ).rejects.toThrow("Mã hạng 'standard' bị trùng lặp.");
    });

    it("ném lỗi nếu trùng tên hạng", async () => {
      const invalidTiers = [
        { code: "standard", name: "Thành viên", minGrossProfit: 0 },
        { code: "vip", name: "Thành viên", minGrossProfit: 5_000_000 },
      ];
      await expect(
        CustomerSettingsService.updateSettings(companyCode, invalidTiers)
      ).rejects.toThrow("Tên hạng 'Thành viên' bị trùng lặp.");
    });
  });
});
