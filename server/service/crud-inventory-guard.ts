export function assertNoLegacyInventoryMutation(modelName: string, payload: unknown) {

  if (modelName === "products" && payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "stock")) {
    const err: any = new Error("Không được sửa tồn trực tiếp trên sản phẩm. Hãy dùng phiếu kho đã xác nhận.");
    err.statusCode = 403;
    throw err;
  }
}
