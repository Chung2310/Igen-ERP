import "dotenv/config";
import mongoose from "mongoose";
import { Payment } from "../modules/student-management/models/payment.model";
import { parsePaymentDate } from "../modules/student-management/utils/payment-date.util";

/**
 * Điền `paidOn` (Date) cho các giao dịch thanh toán đã tạo trước khi trường này
 * tồn tại, bằng cách quy đổi `date` (chuỗi `DD/MM/YYYY` hoặc `YYYY-MM-DD`).
 *
 * Vì sao cần: chuỗi `DD/MM/YYYY` không so sánh được theo thứ tự, nên báo cáo
 * doanh thu phải gom nhóm theo `paidOn`. Giao dịch không có `paidOn` sẽ bị loại
 * khỏi báo cáo — script này kéo phần lớn dữ liệu cũ vào lại.
 *
 * Giao dịch có `date` không quy đổi được sẽ được liệt kê ra để xử lý tay, KHÔNG
 * gán đại một ngày nào đó: đoán sai thì doanh thu rơi sai kỳ mà không để lại dấu vết.
 *
 * An toàn khi chạy lại nhiều lần (chỉ đụng bản ghi chưa có `paidOn`).
 * Chạy: npx tsx server/scripts/backfill-payment-paid-on.ts
 */
async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://mongodb/igen-erp";
  await mongoose.connect(uri);

  try {
    const pending = await Payment.find({ paidOn: { $exists: false } })
      .select("_id date studentName")
      .lean();

    console.log(`Tìm thấy ${pending.length} giao dịch chưa có paidOn.`);

    const operations: any[] = [];
    const unparsable: { id: string; date: unknown; studentName?: string }[] = [];

    for (const doc of pending) {
      const parsed = parsePaymentDate((doc as any).date);

      if (!parsed) {
        unparsable.push({
          id: String(doc._id),
          date: (doc as any).date,
          studentName: (doc as any).studentName,
        });
        continue;
      }

      operations.push({
        updateOne: { filter: { _id: doc._id }, update: { $set: { paidOn: parsed } } },
      });
    }

    if (operations.length > 0) {
      const result = await Payment.bulkWrite(operations, { ordered: false });
      console.log(`Đã điền paidOn cho ${result.modifiedCount} giao dịch.`);
    } else {
      console.log("Không có giao dịch nào cần cập nhật.");
    }

    if (unparsable.length > 0) {
      console.warn(
        `\n${unparsable.length} giao dịch có ngày không đọc được — cần sửa tay, hiện đang bị loại khỏi báo cáo doanh thu:`
      );
      for (const item of unparsable.slice(0, 50)) {
        console.warn(`  - ${item.id} | date=${JSON.stringify(item.date)} | ${item.studentName ?? ""}`);
      }
      if (unparsable.length > 50) {
        console.warn(`  ... và ${unparsable.length - 50} bản ghi khác.`);
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Backfill paidOn thất bại:", error);
  process.exit(1);
});
