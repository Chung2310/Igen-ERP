import "dotenv/config";
import mongoose from "mongoose";
import { RetailOrderModel } from "../modules/retail/models/retail-order.model";
import { RetailCustomerTierJobModel } from "../modules/retail/models/retail-customer-tier-job.model";
import { RepairTicketModel } from "../modules/repair/repair-ticket.model";
import { processPendingTierRefreshJobs } from "../modules/retail/services/retail-customer-tier.service";

/**
 * Xếp hạng lại khách cũ theo lợi nhuận gộp sau khi chuyển khỏi tiêu chí doanh thu.
 *
 * Job có source key phiên bản `gross-profit-v1`, nên sẽ chạy một lần ngay cả khi job backfill cũ
 * đã hoàn tất. Chạy lại script sau khi hoàn thành sẽ không tạo lại job đã xử lý.
 *
 * `branchId` lấy theo giao dịch gần nhất (job cần một chi nhánh để đọc cửa sổ đánh giá),
 * còn đơn hàng và phiếu sửa chữa được tính trên phạm vi công ty.
 *
 * Chạy: npx tsx server/scripts/backfill-customer-tiers.ts
 *
 * An toàn khi chạy lại nhiều lần (job upsert theo `sourceKey` cố định).
 */
async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://mongodb/igen-erp";
  await mongoose.connect(uri);

  try {
    const [orderRows, repairRows] = await Promise.all([
      RetailOrderModel.aggregate<{ _id: { companyCode: string; customerId: string }; branchId: string; activityAt: string }>([
        { $match: { status: { $in: ["confirmed", "completed"] }, customerId: { $nin: [null, ""] } } },
        { $sort: { businessDate: -1, _id: -1 } },
        { $group: { _id: { companyCode: "$companyCode", customerId: "$customerId" }, branchId: { $first: "$branchId" }, activityAt: { $first: "$businessDate" } } },
      ]),
      RepairTicketModel.aggregate<{ _id: { companyCode: string; customerId: string }; branchId: string; activityAt: Date }>([
        { $match: { status: { $in: ["done", "delivered"] }, customerId: { $nin: [null, ""] } } },
        { $sort: { completedAt: -1, _id: -1 } },
        { $group: { _id: { companyCode: "$companyCode", customerId: "$customerId" }, branchId: { $first: "$branchId" }, activityAt: { $first: "$completedAt" } } },
      ]),
    ]);
    const latestByCustomer = new Map<string, { _id: { companyCode: string; customerId: string }; branchId: string; activityAt: number }>();
    for (const row of [...orderRows, ...repairRows]) {
      const key = `${row._id.companyCode}:${row._id.customerId}`;
      const activityAt = new Date(row.activityAt).getTime();
      const current = latestByCustomer.get(key);
      if (row.branchId && Number.isFinite(activityAt) && (!current || activityAt > current.activityAt)) {
        latestByCustomer.set(key, { _id: row._id, branchId: row.branchId, activityAt });
      }
    }
    const rows = [...latestByCustomer.values()];
    console.log(`Tìm thấy ${rows.length} khách hàng cần xếp hạng lại theo lợi nhuận gộp.`);
    if (!rows.length) return;

    const operations = rows.map((row) => ({
      updateOne: {
        filter: { companyCode: row._id.companyCode, sourceKey: `backfill:tier:gross-profit:v1:${row._id.customerId}` },
        update: {
          $setOnInsert: {
            companyCode: row._id.companyCode, branchId: String(row.branchId), customerId: String(row._id.customerId),
            sourceKey: `backfill:tier:gross-profit:v1:${row._id.customerId}`, status: "pending" as const, attempts: 0,
          },
        },
        upsert: true,
      },
    }));
    const written = await RetailCustomerTierJobModel.bulkWrite(operations, { ordered: false });
    console.log(`Đã tạo ${written.upsertedCount} job mới (${rows.length - written.upsertedCount} job đã tồn tại từ lần chạy trước).`);

    let processed = 0, failed = 0;
    for (;;) {
      const batch = await processPendingTierRefreshJobs(200);
      processed += batch.processed; failed += batch.failed;
      if (batch.processed === 0) break;
      console.log(`  ... đã xử lý ${processed} khách hàng.`);
    }
    console.log(`Hoàn tất: ${processed} khách đã được xếp hạng, ${failed} lỗi.`);
    if (failed > 0) console.warn("Job lỗi vẫn nằm ở trạng thái 'failed' và sẽ được worker thử lại tự động.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Backfill hạng khách hàng thất bại:", error);
  process.exit(1);
});
