import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import { getWalletSummary, listLedger } from '../services/creditWalletService.js';
import { createPaymentOrder, getTopupRate, gatewayAvailability, getPaymentOrder, listActivePackages, settleSepayCallback, settleMomoCallback, settlePayosCallback, settleVnpayCallback } from '../services/paymentService.js';
import { verifyVnpayCallback } from '../services/vnpayGateway.js';

export const me = asyncHandler(async (req, res) => success(res, { message: 'Đã tải ví credit.', data: await getWalletSummary(req.user!.id) }));
export const ledger = asyncHandler(async (req, res) => {
  const result = await listLedger(req.user!.id, req.query);
  return success(res, { message: 'Đã tải lịch sử credit.', data: result.items, meta: result.meta });
});
export const packages = asyncHandler(async (_req, res) => success(res, { message: 'Đã tải các gói credit.', data: { packages: await listActivePackages(), gateways: gatewayAvailability(), vndPerCredit: await getTopupRate() } }));
export const createTopup = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Đã tạo đơn nạp credit.', data: await createPaymentOrder(req.user!.id, req.body, req.ip || '127.0.0.1') }));
export const topup = asyncHandler(async (req, res) => success(res, { message: 'Đã tải đơn nạp credit.', data: await getPaymentOrder(req.user!.id, String(req.params.id)) }));
export const payosWebhook = asyncHandler(async (req, res) => success(res, { message: 'Đã xử lý webhook PayOS.', data: await settlePayosCallback(req.body) }));
export const vnpayIpn = asyncHandler(async (req, res) => success(res, { message: 'Đã xử lý callback VNPay.', data: await settleVnpayCallback(req.query as Record<string, unknown>) }));
export const vnpayReturn = asyncHandler(async (req, res) => success(res, { message: 'Đã xác nhận dữ liệu chuyển hướng VNPay. Credit chỉ được cấp qua IPN.', data: verifyVnpayCallback(req.query as Record<string, unknown>) }));
export const momoIpn = asyncHandler(async (req, res) => success(res, { message: 'Đã xử lý callback MoMo.', data: await settleMomoCallback(req.body) }));

export const sepayWebhook = asyncHandler(async (req, res) => {
  await settleSepayCallback(req.body, req.get('Authorization'));
  return res.status(200).json({ success: true });
});
