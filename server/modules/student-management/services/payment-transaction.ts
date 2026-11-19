import mongoose, { type ClientSession } from "mongoose";

/** A receipt and its student's ledger must commit together. Never fall back to partial writes. */
export async function runStudentPaymentTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } catch (error) {
    if ((error as { code?: number }).code === 20) throw Object.assign(new Error("Cơ sở dữ liệu chưa hỗ trợ giao dịch đồng bộ. Chưa ghi nhận khoản thu, cần cấu hình MongoDB replica set trước khi thu tiền."), { status: 503 });
    throw error;
  } finally {
    // Session cleanup must not turn a known committed receipt into a failed write.
    try { await session.endSession(); } catch { console.warn("[student-payment] Transaction session cleanup failed"); }
  }
}
