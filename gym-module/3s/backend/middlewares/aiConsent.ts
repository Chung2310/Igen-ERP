import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { getEnv } from '../config/env.js';

function usesExternalAi(method: string, path: string) {
  const route = path.replace(/\/+$/, '').toLowerCase();
  if (method === 'GET') return route === '/nutrition/meal-image';
  if (method !== 'POST') return false;
  return route.startsWith('/content-drafts/') ||
    ['/ai/exercise-generations', '/ai/workout-proposals', '/ai/workout-generations', '/inbody/ocr',
      '/nutrition/calculate', '/nutrition/scan-inbody', '/images/generate', '/images/meal-image',
      '/food-images/ai-generate', '/assistant/suggestions'].includes(route) ||
    /^\/assistant\/conversations\/[^/]+\/messages$/.test(route) ||
    /^\/food-images\/[^/]+\/regenerate-ai$/.test(route);
}

// Runs before controllers, uploads and job enqueueing. No AI provider is called
// until the client confirms the disclosure returned for this request.
export const requireAiConsent: RequestHandler = (req, res, next) => {
  if (!usesExternalAi(req.method, req.path)) return next();
  const env = getEnv();
  const message = `Để xử lý yêu cầu này, nội dung bạn nhập, ảnh/tài liệu tải lên và dữ liệu hồ sơ liên quan (có thể gồm họ tên, chỉ số cơ thể, tiền sử sức khỏe) sẽ được gửi tới OpenRouter và nhà cung cấp mô hình AI. Các mô hình cấu hình: ${env.AI_MODEL}, ${env.OCR_MODEL}; chức năng tạo ảnh dùng Google Gemini qua OpenRouter. Dữ liệu có thể được xử lý ngoài Việt Nam. Chỉ tiếp tục khi bạn đồng ý chia sẻ dữ liệu của mình và đã có sự cho phép phù hợp của học viên nếu dùng dữ liệu của họ. Bạn có thể hủy và tiếp tục dùng các chức năng không dùng AI. Xác nhận chỉ áp dụng cho yêu cầu này, bao gồm tác vụ nền và lần thử lại của yêu cầu.`;
  const version = createHash('sha256').update(message).digest('hex');
  if (req.get('X-AI-Consent') === version) return next();
  return res.status(428).json({ success: false, code: 'AI_CONSENT_REQUIRED', message,
    consentVersion: version, privacyUrl: 'https://3s.igentechnology.net/privacy-policy',
    requestId: req.requestId });
};
