import "dotenv/config";
import mongoose from "mongoose";
import { RetailOrderModel } from "../modules/retail/models/retail-order.model";
import { RetailCustomerTierJobModel } from "../modules/retail/models/retail-customer-tier-job.model";
import { processPendingTierRefreshJobs } from "../modules/retail/services/retail-customer-tier.service";

/**
 * Điền `tier` cho các khách hàng đã có đơn trước khi trường này tồn tại.
 *
 * Vì sao cần: hạng khách trước đây chỉ nằm trong lịch sử `RetailCustomerTierHistory`.
 * Nay hạng được ghi thẳng lên hồ sơ khách (badge ở POS, lọc chiến dịch marketing đọc từ đó),
 * nên khách cũ sẽ trống hạng cho tới lần mua kế tiếp nếu không backfill.
 *
 * Cách làm: tạo job xếp hạng cho từng khách rồi để đúng worker của production xử lý —
 * không nhân bản logic tính hạng, nên cửa sổ đánh giá và bậc hạng luôn khớp với runtime.
 * `branchId` lấy theo đơn gần nhất của khách (job cần một chi nhánh để đọc cài đặt bán lẻ);
 * doanh số thì luôn cộng trên toàn công ty.
 *
 * Khách chưa có đơn nào bị bỏ qua — họ chưa phát sinh chi tiêu nên chưa có hạng.
 *
 * An toàn khi chạy lại nhiều lần (job upsert theo `sourceKey` cố định).
 * Chạy: npx tsx server/scripts/backfill-customer-tiers.ts
 */
async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://mongodb/igen-erp";
  await mongoose.connect(uri);

  try {
    const rows = await RetailOrderModel.aggregate<{ _id: { companyCode: string; customerId: string }; branchId: string }>([
      { $match: { status: { $in: ["confirmed", "completed"] }, customerId: { $nin: [null, ""] } } },
      { $sort: { businessDate: -1, _id: -1 } },
      { $group: { _id: { companyCode: "$companyCode", customerId: "$customerId" }, branchId: { $first: "$branchId" } } },
    ]);
    console.log(`Tìm thấy ${rows.length} khách hàng có đơn cần xếp hạng lại.`);
    if (!rows.length) return;

    const operations = rows.map((row) => ({
      updateOne: {
        filter: { companyCode: row._id.companyCode, sourceKey: `backfill:tier:${row._id.customerId}` },
        update: {
          $setOnInsert: {
            companyCode: row._id.companyCode, branchId: String(row.branchId), customerId: String(row._id.customerId),
            sourceKey: `backfill:tier:${row._id.customerId}`, status: "pending" as const, attempts: 0,
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
