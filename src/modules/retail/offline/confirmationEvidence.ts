export function verifyConfirmation(result: any, orderId?: string) {
  if (!result?.order?._id || !result?.invoice?._id || (orderId && result.order._id !== orderId) || (result.invoice.orderId && result.invoice.orderId !== result.order._id)) throw new Error("Kết quả xác nhận chưa đủ bằng chứng. Giữ yêu cầu để đối chiếu.");
}
