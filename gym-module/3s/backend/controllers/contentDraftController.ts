import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import {
  createNutritionDraft,
  createWorkoutDraft,
  createRoadmapDraft,
  analyzeNutritionByAi,
} from '../services/contentDraftService.js';

const nutrition = asyncHandler(async (req, res) =>
  success(res, {
    status: 201,
    message: 'AI đã tạo thực đơn nháp. PT cần kiểm tra trước khi sử dụng.',
    data: await createNutritionDraft(req.user!, req.body.customerId, req.body.request, req.requestId!, req.body.planId),
  })
);

const workout = asyncHandler(async (req, res) =>
  success(res, {
    status: 201,
    message: 'AI đã tạo giáo án nháp. PT cần kiểm tra trước khi sử dụng.',
    data: await createWorkoutDraft(req.user!, req.body.customerId, req.body.request, req.requestId!),
  })
);

const roadmap = asyncHandler(async (req, res) => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, 170_000);
  res.once('close', abort);
  try {
    const data = await createRoadmapDraft(req.user!, req.body.customerId, req.body.request, req.requestId!, {
      durationWeeks: req.body.durationWeeks, sessionsPerWeek: req.body.sessionsPerWeek,
      goalType: req.body.goalType, targetValue: req.body.targetValue, targetUnit: req.body.targetUnit,
      sessionDurationMinutes: req.body.sessionDurationMinutes,
    }, controller.signal);
    if (controller.signal.aborted) throw new AppError({ status: 504, code: ERROR_CODES.EXTERNAL, message: 'Đã hết thời gian xử lý lộ trình AI.' });
    success(res, {
      status: 201, message: 'AI đã tạo đề xuất lộ trình. PT hãy kiểm tra và tinh chỉnh.', data,
    });
  } finally {
    clearTimeout(timer);
    res.removeListener('close', abort);
  }
});

const nutritionAnalysis = asyncHandler(async (req, res) =>
  success(res, {
    status: 200,
    message: 'AI đã phân tích thể trạng, nhu cầu và tính toán Calo/Macros thành công.',
    data: await analyzeNutritionByAi(req.user!, req.body, req.requestId!),
  })
);

export { nutrition, workout, roadmap, nutritionAnalysis };

