import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../config/firebase";
import { StockLog, StockLogItem } from "../types";

const COLLECTION_NAME = "inventoryStockLogs";

// ─── Input types ──────────────────────────────────────────────────────────────

export type StockLogCreateInput = {
  type: "nhập" | "xuất";
  title: string;
  operatorName: string;
  notes: string;
  status: "Đang chờ" | "Đang xử lý" | "Hoàn thành";
  items: StockLogItem[];
  /** Trường legacy — SKU của item đầu tiên */
  sku: string;
  /** Trường legacy — tên sản phẩm đầu tiên */
  productName: string;
  /** Trường legacy — tổng số lượng */
  quantity: number;
};

export type StockLogUpdateInput = StockLogCreateInput & { id: string };

// ─── Collection reference ──────────────────────────────────────────────────────

const collectionRef = collection(db, COLLECTION_NAME);

// ─── Service ──────────────────────────────────────────────────────────────────

export const inventoryStockLogService = {
  /**
   * Lắng nghe real-time danh sách phiếu, sắp xếp mới nhất trước.
   * Trả về hàm unsubscribe.
   */
  subscribe(
    callback: (logs: StockLog[]) => void,
    onError?: (error: unknown) => void
  ) {
    const logQuery = query(collectionRef, orderBy("createdAtTimestamp", "desc"));

    return onSnapshot(
      logQuery,
      (snapshot) => {
        const logs = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<StockLog, "id">),
        }));
        callback(logs);
      },
      (error) => {
        if (onError) {
          onError(error);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      }
    );
  },

  /** Tạo phiếu mới và ghi vào Firestore */
  async createLog(input: StockLogCreateInput): Promise<string> {
    try {
      const createdDoc = await addDoc(collectionRef, {
        type: input.type,
        title: input.title,
        items: input.items,
        sku: input.sku,
        productName: input.productName,
        quantity: input.quantity,
        operatorName: input.operatorName,
        notes: input.notes,
        status: input.status,
        createdAt: new Date().toLocaleString("vi-VN"),
        createdAtTimestamp: serverTimestamp(),
      });
      return createdDoc.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
      throw error;
    }
  },

  /** Cập nhật phiếu đã tồn tại */
  async updateLog(id: string, input: StockLogCreateInput): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        type: input.type,
        title: input.title,
        items: input.items,
        sku: input.sku,
        productName: input.productName,
        quantity: input.quantity,
        operatorName: input.operatorName,
        notes: input.notes,
        status: input.status,
        updatedAt: new Date().toLocaleString("vi-VN"),
        updatedAtTimestamp: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
      throw error;
    }
  },

  /** Xóa phiếu khỏi Firestore (không hoàn tác tồn kho) */
  async deleteLog(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
      throw error;
    }
  },
};
