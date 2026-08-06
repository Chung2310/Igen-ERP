import "dotenv/config";
import mongoose from "mongoose";
import { BatchEnrollment } from "../server/modules/student-management/models/batch-enrollment.model";
import { StudentBatchEnrollment } from "../server/modules/student-management/models/student-batch-enrollment.model";

const STATUS_MAP = { active: "Đang học", completed: "Hoàn thành khóa", removed: "Không còn nhu cầu học" } as const;

/**
 * Chuyển các bản ghi sổ buổi cũ sang BatchEnrollment - nguồn ghi danh chuẩn.
 * Mặc định chỉ xem trước; thêm --apply mới ghi dữ liệu. Có thể chạy lại an toàn.
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/igen-erp";
  await mongoose.connect(uri);
  try {
    let scanned = 0;
    let created = 0;
    const cursor = StudentBatchEnrollment.find({}).lean().cursor();
    for await (const legacy of cursor) {
      scanned += 1;
      const filter = { ownerId: legacy.ownerId, branchId: legacy.branchId, batchId: legacy.batchId, studentId: legacy.studentId };
      if (await BatchEnrollment.exists(filter)) continue;
      created += 1;
      if (!apply) continue;
      const status = STATUS_MAP[legacy.status as keyof typeof STATUS_MAP] || "Đang học";
      await BatchEnrollment.create({
        ...filter, status, allowedSessions: legacy.allowedSessions || 0, attendedSessions: legacy.attendedSessions || 0,
        joinedAt: legacy.enrolledAt || legacy.createdAt || new Date(), leftAt: legacy.leftAt || null, enrollmentReason: "manual",
        history: [{ at: legacy.enrolledAt || legacy.createdAt || new Date(), action: "migrated_from_legacy", actorId: "migration" }],
      });
    }
    console.log(`${apply ? "Đã chuyển" : "Sẽ chuyển"} ${created}/${scanned} bản ghi sang BatchEnrollment.${apply ? "" : " Chạy lại với --apply để thực hiện."}`);
  } finally { await mongoose.disconnect(); }
}

main().catch((error) => { console.error("Migration enrollment thất bại:", error); process.exitCode = 1; });
