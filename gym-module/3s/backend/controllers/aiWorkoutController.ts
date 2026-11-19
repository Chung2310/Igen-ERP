import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import { createWorkoutProposal } from '../services/aiWorkoutService.js';
import { generateExerciseDrafts } from '../services/aiExerciseService.js';
import {
  enqueueWorkoutGeneration,
  getWorkoutGeneration,
} from '../services/aiWorkoutGenerationJobService.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

export const proposal = asyncHandler(async (req, res) => success(res, { message: 'AI đã tạo đề xuất giáo án. PT hãy kiểm tra trước khi tạo chi tiết.', data: await createWorkoutProposal(req.user!, req.body.customerId, req.body.availabilitySlots, req.requestId!) }));
export const generation = asyncHandler(async (req, res) => {
  const header = req.get('idempotency-key');
  if (header && !/^[A-Za-z0-9._:-]{8,100}$/.test(header)) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Idempotency-Key của tác vụ AI không hợp lệ.' });
  }
  return success(res, {
    status: 202,
    message: 'Đã tiếp nhận yêu cầu tạo giáo án AI.',
    data: await enqueueWorkoutGeneration(req.user!, req.body, header || req.requestId!),
  });
});
export const generationStatus = asyncHandler(async (req, res) => success(res, {
  message: 'Đã tải trạng thái tạo giáo án AI.',
  data: await getWorkoutGeneration(req.user!, String(req.params.id)),
}));
export const exerciseGeneration = asyncHandler(async (req, res) => success(res, {
  message: 'AI đã tạo bản nháp bài tập. Hãy kiểm tra trước khi lưu.',
  data: await generateExerciseDrafts(req.user!, req.body, req.requestId!),
}));
