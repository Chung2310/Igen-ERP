import type { InventoryCountStatus } from "../../../interface/inventory.interface";

const transitions: Record<InventoryCountStatus, InventoryCountStatus[]> = {
  draft: ["counting", "cancelled"],
  counting: ["pending_approval", "cancelled"],
  pending_approval: ["completed", "conflict"],
  completed: [],
  cancelled: [],
  conflict: [],
};

export function calculateQuantityDelta(systemQuantity: number, countedQuantity: number) {
  if (!Number.isFinite(systemQuantity) || systemQuantity < 0) throw new Error("Tồn hệ thống không hợp lệ.");
  if (!Number.isFinite(countedQuantity) || countedQuantity < 0) throw new Error("Số lượng kiểm kê không hợp lệ.");
  return countedQuantity - systemQuantity;
}

export function assertCountTransition(from: InventoryCountStatus, to: InventoryCountStatus) {
  if (!transitions[from]?.includes(to)) throw new Error(`Không thể chuyển phiếu kiểm kê từ ${from} sang ${to}.`);
}

export function assertEditableStatus(status: InventoryCountStatus) {
  if (status !== "draft" && status !== "counting") throw new Error("Phiếu kiểm kê không còn cho phép chỉnh sửa.");
}
