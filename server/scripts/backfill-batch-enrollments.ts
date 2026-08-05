import "dotenv/config";
import mongoose from "mongoose";
import { Batch } from "../modules/student-management/models/batch.model";
import { backfillBatchEnrollments } from "../modules/student-management/services/batch.service";
import { runBatchEnrollmentBackfill } from "../modules/student-management/utils/batch-enrollment-backfill.util";

/**
 * Tạo sổ buổi còn thiếu cho tất cả lớp cũ có học viên. Script chỉ tạo những
 * enrollment chưa tồn tại nên có thể chạy lại an toàn khi triển khai.
 * Chạy: npx tsx server/scripts/backfill-batch-enrollments.ts
 */
async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://mongodb/igen-erp";
  await mongoose.connect(uri);

  try {
    const cursor = Batch.find({ learnerIds: { $exists: true, $ne: [] } }).cursor();
    const summary = await runBatchEnrollmentBackfill(cursor, backfillBatchEnrollments);
    console.log(`Đã backfill sổ buổi cho ${summary.learners} học viên thuộc ${summary.batches} lớp.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Backfill sổ buổi lớp thất bại:", error);
  process.exit(1);
});