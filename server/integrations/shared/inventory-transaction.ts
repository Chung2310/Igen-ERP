import mongoose, { type ClientSession } from "mongoose";

/** Inventory, its source document, and serial history must commit together. */
export async function runInventoryTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } catch (error: any) {
    if (error?.code === 20 && /transaction numbers are only allowed/i.test(String(error.message))) {
      throw Object.assign(new Error("Giao dịch kho cần MongoDB replica set để bảo đảm tồn kho và chứng từ được ghi đồng thời."), { status: 503, statusCode: 503, code: "INVENTORY_TRANSACTION_REQUIRED" });
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
