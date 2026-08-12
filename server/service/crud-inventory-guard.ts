export function assertNoLegacyInventoryMutation(modelName: string, payload: unknown) {
  if (modelName === "stock-logs") {
    const err: any = new Error("Lịch sử kho là dữ liệu bất biến. Hãy dùng phiếu nhập, bán hàng, trả hàng hoặc điều chuyển để phát sinh biến động.");
    err.statusCode = 403;
    throw err;
  }
  if (modelName === "products" && payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "stock")) {
    const err: any = new Error("Không được sửa tồn trực tiếp trên sản phẩm. Hãy dùng phiếu kho đã xác nhận.");
    err.statusCode = 403;
    throw err;
  }
}
