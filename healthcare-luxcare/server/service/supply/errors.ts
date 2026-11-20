export class SupplyError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}

export function supplyErrorResponse(error: unknown) {
  if (error instanceof SupplyError) return { statusCode: error.statusCode, code: error.code, message: error.message };
  if ((error as { code?: number })?.code === 11000)
    return {
      statusCode: 409,
      code: "SUPPLY_CONFLICT",
      message: "Mã vật tư hoặc chứng từ đã tồn tại. Vui lòng tải lại dữ liệu.",
    };
  return {
    statusCode: 500,
    code: "SUPPLY_OPERATION_FAILED",
    message: "Không thể hoàn tất thao tác vật tư. Vui lòng thử lại hoặc liên hệ quản trị.",
  };
}
