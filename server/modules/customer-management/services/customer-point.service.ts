import type { ClientSession } from "mongoose";
import { CustomerModel } from "../models/customer.model";
import { CustomerPointLedgerModel, type PointTransactionType } from "../models/customer-point-ledger.model";
import { CustomerSettingsService } from "./customer-settings.service";

export interface EarnPointsInput {
  companyCode: string;
  branchId?: string;
  customerId: string;
  points: number;
  sourceType: "retail_order" | "repair_ticket";
  sourceId: string;
  sourceCode?: string;
  reason: string;
  reasonCategory?: "purchase" | "repair";
  session?: ClientSession;
}

export interface RedeemPointsInput {
  companyCode: string;
  branchId?: string;
  customerId: string;
  points: number;
  sourceType: "retail_order" | "repair_ticket";
  sourceId: string;
  sourceCode?: string;
  reason: string;
  actor?: { id: string; name: string };
  session?: ClientSession;
}

export interface ManualPointsInput {
  companyCode: string;
  branchId?: string;
  customerId: string;
  points: number;
  reasonCategory: "birthday" | "compensation" | "loyalty_gift" | "correction";
  reason: string;
  actor: { id: string; name: string };
}

export interface RevertPointsInput {
  companyCode: string;
  branchId?: string;
  customerId: string;
  points: number;
  sourceType: "retail_order" | "repair_ticket";
  sourceId: string;
  sourceCode?: string;
  reason: string;
  actor?: { id: string; name: string };
  session?: ClientSession;
}

function generateTransactionCode(): string {
  const datePart = new Date().toISOString().slice(2, 7).replace("-", ""); // YYMM
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `PNT-${datePart}-${randomPart}`;
}

export class CustomerPointService {
  /**
   * Tự động tích điểm từ hóa đơn bán lẻ hoặc phiếu sửa chữa.
   * Có kiểm tra chống tích trùng lặp theo sourceId.
   */
  static async earnPoints(input: EarnPointsInput) {
    const points = Math.floor(Number(input.points) || 0);
    if (points <= 0) return null;

    const companyCode = input.companyCode.toUpperCase();
    const type: PointTransactionType = input.sourceType === "retail_order" ? "EARN_ORDER" : "EARN_REPAIR";

    // Kiểm tra cài đặt xem có bật tính năng điểm không
    const settings = await CustomerSettingsService.getSettings(companyCode).catch(() => null);
    if (settings?.pointsPolicy && !settings.pointsPolicy.enabled) {
      return null;
    }

    // Kiểm tra chống trùng lặp theo sourceId
    const existing = await CustomerPointLedgerModel.findOne({
      companyCode,
      sourceId: input.sourceId,
      type,
    }).session(input.session || null);

    if (existing) {
      return existing.toObject();
    }

    const customer = await CustomerModel.findOne({
      _id: input.customerId,
      companyCode,
    }).session(input.session || null);

    if (!customer) {
      throw Object.assign(new Error("Không tìm thấy khách hàng."), { statusCode: 404 });
    }

    const balanceBefore = Number(customer.pointsBalance || 0);
    const balanceAfter = balanceBefore + points;

    customer.pointsBalance = balanceAfter;
    customer.totalPointsEarned = Number(customer.totalPointsEarned || 0) + points;
    await customer.save({ session: input.session });

    const ledger = new CustomerPointLedgerModel({
      companyCode,
      branchId: input.branchId,
      customerId: input.customerId,
      transactionCode: generateTransactionCode(),
      type,
      points,
      balanceBefore,
      balanceAfter,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceCode: input.sourceCode,
      reasonCategory: input.reasonCategory || (input.sourceType === "retail_order" ? "purchase" : "repair"),
      reason: input.reason,
      actorId: "system",
      actorName: "Hệ thống tự động",
      createdAt: new Date(),
    });

    await ledger.save({ session: input.session });
    return ledger.toObject();
  }

  /**
   * Tiêu điểm cấn trừ tiền khi thanh toán đơn hàng hoặc sửa chữa.
   */
  static async redeemPoints(input: RedeemPointsInput) {
    const points = Math.floor(Number(input.points) || 0);
    if (points <= 0) {
      throw Object.assign(new Error("Số điểm cấn trừ phải lớn hơn 0."), { statusCode: 400 });
    }

    const companyCode = input.companyCode.toUpperCase();
    const customer = await CustomerModel.findOne({
      _id: input.customerId,
      companyCode,
    }).session(input.session || null);

    if (!customer) {
      throw Object.assign(new Error("Không tìm thấy khách hàng."), { statusCode: 404 });
    }

    const balanceBefore = Number(customer.pointsBalance || 0);
    if (balanceBefore < points) {
      throw Object.assign(
        new Error(`Số dư điểm không đủ để cấn trừ (Khách có ${balanceBefore} điểm, yêu cầu ${points} điểm).`),
        { statusCode: 400 }
      );
    }

    const balanceAfter = balanceBefore - points;
    customer.pointsBalance = balanceAfter;
    customer.totalPointsRedeemed = Number(customer.totalPointsRedeemed || 0) + points;
    await customer.save({ session: input.session });

    const type: PointTransactionType = input.sourceType === "retail_order" ? "REDEEM_ORDER" : "REDEEM_REPAIR";

    const ledger = new CustomerPointLedgerModel({
      companyCode,
      branchId: input.branchId,
      customerId: input.customerId,
      transactionCode: generateTransactionCode(),
      type,
      points: -points,
      balanceBefore,
      balanceAfter,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceCode: input.sourceCode,
      reasonCategory: input.sourceType === "retail_order" ? "purchase" : "repair",
      reason: input.reason,
      actorId: input.actor?.id,
      actorName: input.actor?.name,
      createdAt: new Date(),
    });

    await ledger.save({ session: input.session });
    return ledger.toObject();
  }

  /**
   * Cấp điểm hoặc trừ điểm thủ công bởi Quản lý (Sinh nhật, Tri ân, Đền bù, Sửa sai).
   */
  static async grantManualPoints(input: ManualPointsInput) {
    const points = Math.trunc(Number(input.points) || 0);
    if (points === 0) {
      throw Object.assign(new Error("Số điểm điều chỉnh không được bằng 0."), { statusCode: 400 });
    }

    const reason = String(input.reason || "").trim();
    if (!reason || reason.length < 3) {
      throw Object.assign(new Error("Vui lòng nhập lý do cụ thể cho lần điều chỉnh điểm này."), { statusCode: 400 });
    }

    const companyCode = input.companyCode.toUpperCase();
    const customer = await CustomerModel.findOne({
      _id: input.customerId,
      companyCode,
    });

    if (!customer) {
      throw Object.assign(new Error("Không tìm thấy khách hàng."), { statusCode: 404 });
    }

    const balanceBefore = Number(customer.pointsBalance || 0);
    const balanceAfter = balanceBefore + points;

    if (balanceAfter < 0) {
      throw Object.assign(
        new Error(`Không thể trừ ${Math.abs(points)} điểm vì khách chỉ có ${balanceBefore} điểm.`),
        { statusCode: 400 }
      );
    }

    customer.pointsBalance = balanceAfter;
    if (points > 0) {
      customer.totalPointsEarned = Number(customer.totalPointsEarned || 0) + points;
    }
    await customer.save();

    const type: PointTransactionType = points > 0 ? "MANUAL_GRANT" : "MANUAL_DEDUCT";

    const ledger = new CustomerPointLedgerModel({
      companyCode,
      branchId: input.branchId,
      customerId: input.customerId,
      transactionCode: generateTransactionCode(),
      type,
      points,
      balanceBefore,
      balanceAfter,
      sourceType: "manual",
      reasonCategory: input.reasonCategory,
      reason,
      actorId: input.actor.id,
      actorName: input.actor.name,
      createdAt: new Date(),
    });

    await ledger.save();
    return ledger.toObject();
  }

  /**
   * Thu hồi điểm khi khách trả hàng hoặc hoàn tiền sửa chữa.
   */
  static async revertRefundPoints(input: RevertPointsInput) {
    const points = Math.floor(Number(input.points) || 0);
    if (points <= 0) return null;

    const companyCode = input.companyCode.toUpperCase();
    const customer = await CustomerModel.findOne({
      _id: input.customerId,
      companyCode,
    }).session(input.session || null);

    if (!customer) return null;

    const balanceBefore = Number(customer.pointsBalance || 0);
    const balanceAfter = Math.max(0, balanceBefore - points);

    customer.pointsBalance = balanceAfter;
    customer.totalPointsEarned = Math.max(0, Number(customer.totalPointsEarned || 0) - points);
    await customer.save({ session: input.session });

    const ledger = new CustomerPointLedgerModel({
      companyCode,
      branchId: input.branchId,
      customerId: input.customerId,
      transactionCode: generateTransactionCode(),
      type: "REFUND_REVERT",
      points: -points,
      balanceBefore,
      balanceAfter,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceCode: input.sourceCode,
      reasonCategory: "refund",
      reason: input.reason,
      actorId: input.actor?.id || "system",
      actorName: input.actor?.name || "Hệ thống tự động",
      createdAt: new Date(),
    });

    await ledger.save({ session: input.session });
    return ledger.toObject();
  }

  /**
   * Tra cứu Sổ cái Lịch sử Điểm của khách hàng (phân trang).
   */
  static async getPointLedger(
    companyCode: string,
    customerId: string,
    options: { page?: number; limit?: number; type?: string } = {}
  ) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {
      companyCode: companyCode.toUpperCase(),
      customerId,
    };

    if (options.type) {
      filter.type = options.type;
    }

    const [items, total] = await Promise.all([
      CustomerPointLedgerModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CustomerPointLedgerModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
