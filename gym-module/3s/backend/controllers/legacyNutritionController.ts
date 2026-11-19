import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import { generateText } from '../services/aiProvider.js';
import { getMealImage } from '../services/mealImageService.js';
import { scanInBodyDraft } from '../services/nutritionScanService.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { AuthenticatedUser } from '../types/express.js';

export interface LegacyCalculateInput {
  clientName?: string;
  gender?: 'male' | 'female';
  weight: number | string;
  height: number | string;
  age: number | string;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  mealCount?: number | string;
  timeframe?: '1_day' | '1_week' | '1_month';
}

export async function calculateLegacyNutrition(user: AuthenticatedUser, input: LegacyCalculateInput, requestKey: string) {
  const weight = Number(input.weight); const height = Number(input.height); const age = Number(input.age);
  const heightMeters = height / 100;
  const bmi = Number((weight / heightMeters ** 2).toFixed(1));
  const minIdealWeight = Number((18.5 * heightMeters ** 2).toFixed(1));
  const maxIdealWeight = Number((22.9 * heightMeters ** 2).toFixed(1));
  const goal = weight < minIdealWeight ? 'gain' : weight > maxIdealWeight ? 'lose' : 'maintain';
  const bmiCategory = goal === 'gain' ? 'Thiếu cân' : goal === 'lose' ? 'Thừa cân' : 'Bình thường';
  const actionRecommendation = goal === 'gain' ? 'NÊN TĂNG CÂN' : goal === 'lose' ? 'NÊN GIẢM CÂN' : 'NÊN DUY TRÌ VÓC DÁNG';
  const actionTargetText = goal === 'gain'
    ? `Cần tăng tối thiểu +${(minIdealWeight - weight).toFixed(1)} kg`
    : goal === 'lose' ? `Cần giảm -${(weight - maxIdealWeight).toFixed(1)} kg` : 'Cân nặng đang nằm trong khoảng hợp lý';
  const bmr = 10 * weight + 6.25 * height - 5 * age + (input.gender === 'female' ? -161 : 5);
  const activityFactors = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  const tdee = Math.round(bmr * activityFactors[input.activityLevel || 'moderate']);
  const targetCalories = Math.round(tdee + (goal === 'gain' ? 500 : goal === 'lose' ? -500 : 0));
  const macros = {
    protein: Math.round(targetCalories * 0.30 / 4), carbs: Math.round(targetCalories * 0.45 / 4), fat: Math.round(targetCalories * 0.25 / 9),
  };
  const timeframe = input.timeframe || '1_day';
  const timeframeLabel = timeframe === '1_week' ? '1 Tuần' : timeframe === '1_month' ? '1 Tháng (4 Tuần)' : '1 Ngày';
  let adviceText: string | null = null;
  try {
    adviceText = await generateText({ userId: user.id, taskType: 'TEXT_NUTRITION', requestKey: `${requestKey}:text-nutrition-legacy` }, `Tạo tư vấn dinh dưỡng an toàn cho ${input.clientName || 'hội viên'}, ${targetCalories} kcal/ngày, ${input.mealCount || 3} bữa. Không chẩn đoán y khoa.`);
  } catch (error) {
    if (error instanceof AppError && error.code === ERROR_CODES.INSUFFICIENT_CREDITS) throw error;
    adviceText = null;
  }
  return {
    formula: 'MIFFLIN_ST_JEOR', clientName: input.clientName || 'Hội viên 3S', bmi, bmiCategory,
    minIdealWeight, maxIdealWeight, actionRecommendation, actionTargetText, bmr: Math.round(bmr), tdee,
    targetCalories, goalText: goal, macros, mealCount: input.mealCount || 3, timeframe, timeframeLabel,
    waterLiters: Number((weight * 0.04).toFixed(1)), posterList: [], adviceText,
    openRouterResponse: adviceText, isRealAI: Boolean(adviceText),
  };
}

function deprecate(res: Parameters<typeof success>[0], canonical: string) {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Link', `<${canonical}>; rel="successor-version"`);
}

export const calculate = asyncHandler(async (req, res) => {
  deprecate(res, '/api/nutrition/metrics');
  return success(res, { message: 'Tính toán và tạo tư vấn dinh dưỡng thành công.', data: await calculateLegacyNutrition(req.user!, req.body, req.requestId!) });
});

export const mealImage = asyncHandler(async (req, res) => {
  deprecate(res, '/api/content-drafts/nutrition');
  const prompt = typeof req.query.prompt === 'string' ? req.query.prompt : 'Full healthy meal platter set with dishes on table';
  const seed = typeof req.query.seed === 'string' ? req.query.seed : '3s-gym';
  const image = await getMealImage({ userId: req.user!.id, taskType: 'IMAGE_GENERATION', requestKey: `${req.requestId}:legacy-meal-image` }, prompt, seed);
  res.setHeader('Content-Type', image.contentType || 'image/jpeg');
  res.setHeader('Cache-Control', 'private, no-store');
  return res.end(image.buffer);
});

export const scanInBody = asyncHandler(async (req, res) => {
  deprecate(res, '/api/inbody/ocr');
  return success(res, { message: 'Đã quét phiếu InBody. PT cần kiểm tra dữ liệu trước khi xác nhận.', data: await scanInBodyDraft(req.user!, req.body, req.requestId!) });
});
