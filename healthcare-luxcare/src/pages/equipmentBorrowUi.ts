export const equipmentStatusLabel = (status: string) => ({
  available: "Sẵn sàng",
  requested: "Đã có người tạo đơn",
  "in-use": "Đang sử dụng",
  maintenance: "Bảo trì",
  retired: "Thanh lý",
}[status] || status);

export function equipmentActions(equipment: any, requests: any[], userId?: string) {
  const pending = requests.find((request) =>
    request.equipmentId === equipment._id && request.employeeId === userId && request.status === "pending",
  );
  return {
    canBorrow: equipment.status === "available",
    canCancel: equipment.status === "requested" && pending?.requestType === "borrow",
    canReturn: equipment.status === "in-use" && String(equipment.currentBorrowerId) === String(userId),
    pendingRequestId: pending?._id,
  };
}
