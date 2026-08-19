import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyModel } from "../../../model/company.model";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { RetailOrderModel } from "../../retail/models/retail-order.model";
import { RetailCustomerTierHistoryModel } from "../../retail/models/retail-customer-tier-history.model";
import { MarketingCampaignModel } from "../models/marketing-campaign.model";
import { MarketingDeliveryModel } from "../models/marketing-delivery.model";
import { MarketingRunModel } from "../models/marketing-run.model";
import {
  isSendTime,
  vietnamParts,
  runBirthdayScan,
  runHolidayScan,
  runRemarketingScan,
} from "./marketing-scan.service";
import { MARKETING_CHANNEL_ADAPTERS } from "./marketing-channels";

describe("vietnamParts", () => {
  it("quy đổi thời điểm UTC sang ngày giờ Việt Nam", () => {
    const parts = vietnamParts(new Date("2026-08-19T01:00:00Z"), "Asia/Ho_Chi_Minh");
    expect(parts).toMatchObject({ date: "2026-08-19", month: "08", day: "19", time: "08:00" });
  });

  it("qua nửa đêm giờ VN thì sang ngày mới", () => {
    expect(vietnamParts(new Date("2026-08-19T17:30:00Z"), "Asia/Ho_Chi_Minh").date).toBe("2026-08-20");
  });
});

describe("isSendTime", () => {
  const settings = { timeZone: "Asia/Ho_Chi_Minh", sendTime: "08:00" };

  it("đúng phút cấu hình mới chạy quét", () => {
    expect(isSendTime(new Date("2026-08-19T01:00:00Z"), settings)).toBe(true);
    expect(isSendTime(new Date("2026-08-19T01:01:00Z"), settings)).toBe(false);
  });
});

describe("marketing-scan service integration", () => {
  let replSet: MongoMemoryReplSet;
  const companyCode = "IGEN";

  const mockSettings = {
    timeZone: "Asia/Ho_Chi_Minh",
    sendTime: "08:00",
    birthday: { enabled: true, channels: ["email"], subject: "Chúc mừng sinh nhật {{customerName}}", html: "<p>Happy birthday!</p>" },
    holiday: { enabled: true, channels: ["email"], subject: "Chúc mừng ngày lễ", html: "<p>Happy Holiday!</p>" },
    remarketing: { enabled: true, channels: ["email"], subject: "Lâu rồi không gặp {{customerName}}", html: "<p>We miss you!</p>" },
    remarketingInactiveDays: 30,
    remarketingCooldownDays: 90,
  };

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    vi.spyOn(MARKETING_CHANNEL_ADAPTERS.email, "isConfigured").mockResolvedValue(true);
    vi.spyOn(MARKETING_CHANNEL_ADAPTERS.email, "send").mockResolvedValue({ messageId: "msg-123" });
  });

  beforeEach(async () => {
    await Promise.all([
      CompanyModel.deleteMany({}),
      CustomerModel.deleteMany({}),
      RetailOrderModel.deleteMany({}),
      RetailCustomerTierHistoryModel.deleteMany({}),
      MarketingCampaignModel.deleteMany({}),
      MarketingDeliveryModel.deleteMany({}),
      MarketingRunModel.deleteMany({}),
    ]);

    await CompanyModel.create({ code: companyCode, name: "Cửa hàng iGen", lifecycleStatus: "active", ownerEmail: "owner@example.com" });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  describe("runBirthdayScan", () => {
    it("quét và gửi tin nhắn chúc mừng sinh nhật cho khách hàng có ngày sinh nhật hôm nay", async () => {
      // Khách hàng sinh nhật hôm nay (19/08)
      await CustomerModel.create({
        companyCode,
        customerCode: "CUST-001",
        name: "Nguyễn Thu Lan",
        email: "lan@example.com",
        phone: "0900000001",
        normalizedPhone: "0900000001",
        status: "active",
        dateOfBirth: new Date("1995-08-19T00:00:00Z"),
        createdBy: "test",
        createdByName: "test",
      });

      // Khách hàng sinh nhật ngày khác
      await CustomerModel.create({
        companyCode,
        customerCode: "CUST-002",
        name: "Trần Văn Nam",
        email: "nam@example.com",
        phone: "0900000002",
        normalizedPhone: "0900000002",
        status: "active",
        dateOfBirth: new Date("1995-08-20T00:00:00Z"),
        createdBy: "test",
        createdByName: "test",
      });

      const scanDate = new Date("2026-08-19T01:00:00Z"); // 08:00 giờ VN
      const stats = await runBirthdayScan(companyCode, mockSettings as any, scanDate);

      expect(stats.eligible).toBe(1);
      expect(stats.queued).toBe(1);

      const deliveries = await MarketingDeliveryModel.find({ companyCode }).lean();
      expect(deliveries.length).toBe(1);
      expect(deliveries[0].recipient).toBe("lan@example.com");
      expect(deliveries[0].subject).toContain("Nguyễn Thu Lan");
    });
  });

  describe("runHolidayScan", () => {
    it("quét và gửi tin nhắn chiến dịch lễ tết", async () => {
      await CustomerModel.create({
        companyCode,
        customerCode: "CUST-001",
        name: "Lê Minh",
        email: "minh@example.com",
        phone: "0900000001",
        normalizedPhone: "0900000001",
        status: "active",
        createdBy: "test",
        createdByName: "test",
      });

      // Tạo chiến dịch lễ tết chạy ngày 19/08
      await MarketingCampaignModel.create({
        companyCode,
        name: "Khuyến mãi Quốc khánh",
        runDate: "2026-08-19",
        enabled: true,
        subject: "Chúc mừng Lễ {{holidayName}}",
        html: "<p>Ưu đãi lớn cho {{customerName}}</p>",
        channels: ["email"],
      });

      const scanDate = new Date("2026-08-19T01:00:00Z");
      const stats = await runHolidayScan(companyCode, mockSettings as any, scanDate);

      expect(stats.eligible).toBe(1);
      expect(stats.queued).toBe(1);

      const deliveries = await MarketingDeliveryModel.find({ companyCode }).lean();
      expect(deliveries.length).toBe(1);
      expect(deliveries[0].recipient).toBe("minh@example.com");
      expect(deliveries[0].subject).toBe("Chúc mừng Lễ Khuyến mãi Quốc khánh");
    });
  });

  describe("runRemarketingScan", () => {
    it("quét và gửi tin nhắn chăm sóc khách hàng lâu không mua hàng", async () => {
      const activeCustomer = await CustomerModel.create({
        companyCode,
        customerCode: "CUST-001",
        name: "Vũ Hải",
        email: "hai@example.com",
        phone: "0900000001",
        normalizedPhone: "0900000001",
        status: "active",
        createdBy: "test",
        createdByName: "test",
      });

      // Ngày quét: 19/08. Khách mua lần cuối 90 ngày trước (đáp ứng inactiveDays >= 30)
      // 90 ngày trước của 2026-08-19 là 2026-05-21
      await RetailOrderModel.create({
        companyCode,
        customerId: String(activeCustomer._id),
        status: "completed",
        businessDate: "2026-05-21",
        branchId: new mongoose.Types.ObjectId().toString(),
        salespersonId: new mongoose.Types.ObjectId().toString(),
        salespersonName: "Sales",
        subtotal: 100,
        orderDiscount: 0,
        taxRate: 0,
        taxAmount: 0,
        shippingFee: 0,
        grandTotal: 100,
        totalCost: 80,
        createdBy: "test",
        createdByName: "test",
      });

      const scanDate = new Date("2026-08-19T01:00:00Z");
      const stats = await runRemarketingScan(companyCode, mockSettings as any, scanDate);

      expect(stats.eligible).toBe(1);
      expect(stats.queued).toBe(1);

      const deliveries = await MarketingDeliveryModel.find({ companyCode }).lean();
      expect(deliveries.length).toBe(1);
      expect(deliveries[0].recipient).toBe("hai@example.com");
      expect(deliveries[0].subject).toContain("Vũ Hải");
    });
  });
});
