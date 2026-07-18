import mongoose from "mongoose";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { SuperAdminSessionModel } from "../model/super-admin-session.model";
import { AuditEventModel } from "../model/audit-event.model";
import { TransactionModel } from "../model/transaction.model";
import { WalletModel } from "../model/wallet.model";
import { isSocketIoHealthy } from "../socket";
import * as redisModule from "../infrastructure/rate-limit-redis";

export interface DashboardFilter {
  startDate?: string;
  endDate?: string;
}

export const superAdminDashboardService = {
  async getSummary(filter: DashboardFilter = {}) {
    const { startDate, endDate } = filter;
    const now = new Date();

    // 1. System Health Checks
    const health = {
      api: "healthy",
      database: "unknown",
      redis: "unknown",
      queues: "unknown",
      storage: "unknown",
      socketIo: "unknown",
    };

    // MongoDB Database health
    try {
      health.database = mongoose.connection.readyState === 1 ? "healthy" : "unhealthy";
    } catch {
      health.database = "unhealthy";
    }

    // Redis rate-limit client health
    try {
      const pingRes = await redisModule.getRateLimitRedisClient().ping();
      health.redis = pingRes === "PONG" ? "healthy" : "unhealthy";
      health.queues = health.redis; // BullMQ shares Redis infrastructure
    } catch {
      health.redis = "unhealthy";
      health.queues = "unhealthy";
    }

    // Socket.IO server health
    try {
      health.socketIo = isSocketIoHealthy() ? "healthy" : "unhealthy";
    } catch {
      health.socketIo = "unhealthy";
    }

    // Storage: Cloudinary config check
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    health.storage = (cloudName && apiKey && apiSecret) ? "healthy" : "unhealthy";

    // 2. System Counts
    const [totalTenants, activeTenants, suspendedTenants, totalUsers, activeSessions, lockedAccounts] = await Promise.all([
      CompanyModel.countDocuments(),
      CompanyModel.countDocuments({ status: { $ne: "suspended" } }),
      CompanyModel.countDocuments({ status: "suspended" }),
      UserModel.countDocuments(),
      SuperAdminSessionModel.countDocuments({ revokedAt: { $exists: false }, expiresAt: { $gt: now } }),
      UserModel.countDocuments({ "superAdminSecurity.lockedUntil": { $gt: now } }),
    ]);

    const counts = {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        suspended: suspendedTenants,
      },
      users: totalUsers,
      activeSessions,
      lockedAccounts,
    };

    // 3. Financial summaries
    const walletAgg = await WalletModel.aggregate([
      { $group: { _id: null, total: { $sum: "$balance" } } },
    ]);
    const totalWalletBalance = walletAgg[0]?.total || 0;

    const txMatch: Record<string, any> = { status: "success" };
    if (startDate || endDate) {
      txMatch.createdAt = {};
      if (startDate) txMatch.createdAt.$gte = new Date(startDate);
      if (endDate) txMatch.createdAt.$lte = new Date(endDate);
    }

    const [revAgg, useAgg] = await Promise.all([
      TransactionModel.aggregate([
        { $match: { ...txMatch, type: "deposit" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      TransactionModel.aggregate([
        { $match: { ...txMatch, type: "payment" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);
    const totalRevenue = revAgg[0]?.total || 0;
    const totalUsage = useAgg[0]?.total || 0;

    // Financial breakdown by tenant (companyCode)
    const walletTenantAgg = await WalletModel.aggregate([
      {
        $lookup: {
          from: "users",
          let: { walletUserId: "$userId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: "$_id" }, "$$walletUserId"],
                },
              },
            },
            { $project: { companyCode: 1, companyName: 1 } },
          ],
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$user.companyCode", "UNKNOWN"] },
          companyName: { $first: { $ifNull: ["$user.companyName", "Mặc định"] } },
          totalBalance: { $sum: "$balance" },
        },
      },
    ]);

    const txTenantAgg = await TransactionModel.aggregate([
      { $match: txMatch },
      {
        $lookup: {
          from: "users",
          let: { txUserId: "$userId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: "$_id" }, "$$txUserId"],
                },
              },
            },
            { $project: { companyCode: 1, companyName: 1 } },
          ],
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$user.companyCode", "UNKNOWN"] },
          companyName: { $first: { $ifNull: ["$user.companyName", "Mặc định"] } },
          revenue: {
            $sum: {
              $cond: [
                { $eq: ["$type", "deposit"] },
                "$amount",
                0,
              ],
            },
          },
          usage: {
            $sum: {
              $cond: [
                { $eq: ["$type", "payment"] },
                "$amount",
                0,
              ],
            },
          },
        },
      },
    ]);

    // Merge financial aggregations in memory
    const tenantFinanceMap = new Map<string, { companyCode: string; companyName: string; revenue: number; usage: number; balance: number }>();
    
    // Seed with wallet aggregates
    for (const w of walletTenantAgg) {
      tenantFinanceMap.set(w._id, {
        companyCode: w._id,
        companyName: w.companyName,
        revenue: 0,
        usage: 0,
        balance: w.totalBalance,
      });
    }

    // Merge transaction aggregates
    for (const tx of txTenantAgg) {
      const existing = tenantFinanceMap.get(tx._id);
      if (existing) {
        existing.revenue = tx.revenue;
        existing.usage = tx.usage;
      } else {
        tenantFinanceMap.set(tx._id, {
          companyCode: tx._id,
          companyName: tx.companyName,
          revenue: tx.revenue,
          usage: tx.usage,
          balance: 0,
        });
      }
    }

    const revenueByTenant = Array.from(tenantFinanceMap.values());

    const finance = {
      totalWalletBalance,
      totalRevenue,
      totalUsage,
      revenueByTenant,
    };

    // 4. Security Alerts (Failed logins or lockout events in the last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000);
    const rawAlerts = await AuditEventModel.find({
      occurredAt: { $gte: oneDayAgo },
      result: "failure",
      actionType: { $in: ["security.login.totp.failure", "security.login.password.failure"] },
    });

    const userIds = Array.from(new Set(rawAlerts.map(a => String(a.actorSuperAdminId)).filter(Boolean)));
    const alertUsers = userIds.length > 0 ? await UserModel.find({ _id: { $in: userIds } }).select("email displayName").lean() : [];
    const alertUserMap = new Map(alertUsers.map(u => [String(u._id), u]));

    const securityAlerts = rawAlerts.map((a: any) => {
      const user = alertUserMap.get(String(a.actorSuperAdminId));
      return {
        id: a.eventId,
        type: a.actionType,
        message: `Đăng nhập thất bại cho tài khoản ${user?.email || "Chưa xác định"} từ IP: ${a.sourceIp || "N/A"}.`,
        occurredAt: a.occurredAt,
      };
    });

    // 5. Recent Activity (Top 10 audit logs)
    const rawRecent = await AuditEventModel.find({}, null, { sort: { occurredAt: -1 }, limit: 10 });
    const recentActorIds = Array.from(new Set(rawRecent.map(r => String(r.actorSuperAdminId)).filter(Boolean)));
    const recentUsers = recentActorIds.length > 0 ? await UserModel.find({ _id: { $in: recentActorIds } }).select("email displayName").lean() : [];
    const recentUserMap = new Map(recentUsers.map(u => [String(u._id), u]));

    const recentActivity = rawRecent.map((r: any) => {
      const user = recentUserMap.get(String(r.actorSuperAdminId));
      return {
        id: r.eventId,
        actionType: r.actionType,
        actorEmail: user?.email || "Hệ thống",
        result: r.result,
        occurredAt: r.occurredAt,
        sourceIp: r.sourceIp || "N/A",
      };
    });

    return {
      counts,
      finance,
      health,
      securityAlerts,
      recentActivity,
    };
  },
};
