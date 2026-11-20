import Joi from 'joi';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

const text = Joi.string().trim().min(1).max(5000);
const positive = Joi.number().positive();
const nutrition = Joi.object({
  bmr: positive.required(), tdee: positive.required(), targetCalories: positive.required(),
  calorieDeficitOrSurplus: Joi.number().required(),
  proteinGrams: Joi.number().min(0).required(), carbsGrams: Joi.number().min(0).required(),
  fatGrams: Joi.number().min(0).required(), waterLiters: positive.required(), advice: text.required(),
});
const strategy = Joi.object({
  targetSummary: text.required(), estimatedWeeks: Joi.number().integer().min(1).max(52).required(),
  sessionsPerWeek: Joi.number().integer().min(1).max(7).required(),
  trainingMethod: text.required(), trainingSplit: text.required(), cardioProtocol: text.required(),
  nutrition: nutrition.required(),
  checkpoints: Joi.array().max(52).items(Joi.object({
    week: Joi.number().integer().min(1).required(), title: text.required(), description: text.required(),
  })).required(),
  sessionBudget: Joi.object({ warmupMinutes: Joi.number().integer().min(0).required(), strengthMinutes: Joi.number().integer().min(1).required(), cardioMinutes: Joi.number().integer().min(0).required(), cooldownMinutes: Joi.number().integer().min(0).required() }),
  generationSource: Joi.string().valid('AI', 'TEMPLATE'),
  assumptions: Joi.array().items(text),
});
const phases = Joi.array().required().min(1).max(52).items(Joi.object({
  order: Joi.number().integer().min(1).required(), name: text.required(),
  durationWeeks: Joi.number().integer().min(1).max(52).required(),
  goals: Joi.array().items(text).required(),
  weeks: Joi.array().min(1).max(52).items(Joi.object({
    week: Joi.number().integer().min(1).max(52).required(), focus: text.required(),
    sessionTargets: Joi.number().integer().min(0).max(7).allow(null),
    sessions: Joi.array().max(0),
  })).required(),
}));

export interface RoadmapConstraints {
  durationWeeks: number; sessionsPerWeek: number;
  goalType?: 'WEIGHT_LOSS' | 'FAT_LOSS' | 'WEIGHT_GAIN' | 'MUSCLE_GAIN' | 'RECOMPOSITION' | 'FITNESS' | 'STRENGTH';
  targetValue?: number; targetUnit?: string; sessionDurationMinutes?: number;
}
interface RoadmapContent {
  phases: Array<{ order: number; durationWeeks: number; weeks: Array<{ week: number; sessionTargets?: number | null }> }>;
  strategy?: Record<string, unknown>;
}

/** Check merged content on create, patch and publish, including manually edited drafts. */
export function assertRoadmapConsistency(content: RoadmapContent, status = 400) {
  const fail = (message: string): never => { throw new AppError({ status, code: status === 502 ? ERROR_CODES.EXTERNAL : ERROR_CODES.VALIDATION, message }); };
  const checked = phases.validate(content.phases, { convert: false });
  if (checked.error) fail('Lộ trình cần các giai đoạn và tuần hợp lệ, không chứa bài tập chi tiết.');
  let nextWeek = 1;
  content.phases.forEach((phase, index) => {
    if (phase.order !== index + 1 || phase.durationWeeks !== phase.weeks.length) fail('Thứ tự giai đoạn hoặc số tuần của giai đoạn không khớp.');
    for (const week of phase.weeks) {
      if (week.week !== nextWeek++) fail('Các tuần phải liên tục từ tuần 1, không thiếu hoặc trùng tuần.');
    }
  });
  if (nextWeek - 1 > 52) fail('Lộ trình không được vượt quá 52 tuần.');
  if (content.strategy && Object.keys(content.strategy).length) {
    if (strategy.validate(content.strategy, { convert: false }).error) fail('Chiến lược lộ trình hoặc dữ liệu dinh dưỡng chưa hợp lệ.');
    if (content.strategy.estimatedWeeks !== nextWeek - 1) fail('Tổng số tuần của các giai đoạn không khớp thời lượng lộ trình.');
    const checkpoints = content.strategy.checkpoints as Array<{ week: number }>;
    if (checkpoints.some((cp, i) => cp.week >= nextWeek || (i > 0 && cp.week <= checkpoints[i - 1].week))) fail('Mốc đánh giá phải tăng dần và nằm trong thời lượng lộ trình.');
    const n = content.strategy.nutrition as Record<string, number>;
    if (Math.abs(n.targetCalories - n.tdee - n.calorieDeficitOrSurplus) > 2) fail('Mức thâm hụt/thặng dư không khớp calo mục tiêu và TDEE.');
    if (Math.abs(n.proteinGrams * 4 + n.carbsGrams * 4 + n.fatGrams * 9 - n.targetCalories) > 20) fail('Tổng năng lượng từ macro không khớp calo mục tiêu (sai số tối đa 20 kcal).');
  }
}

export function parseRoadmapDraftShape(value: unknown) {
  const schema = Joi.object({ title: text.required(), strategy: strategy.required(), phases: phases.required(), baseline: Joi.object().pattern(Joi.string(), Joi.number()) }).required();
  const result = schema.validate(value, { convert: false });
  if (result.error) throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'AI trả về lộ trình sai cấu trúc. Vui lòng thử lại hoặc tạo bản mẫu.' });
  const draft = result.value as RoadmapContent & { title: string; strategy: Record<string, unknown>; baseline?: Record<string, number> };
  return draft;
}

export function validateRoadmapDraft(value: unknown, constraints?: RoadmapConstraints) {
  const draft = parseRoadmapDraftShape(value);
  assertRoadmapConsistency(draft, 502);
  if (draft.phases.some((phase) => phase.weeks.some((week) => typeof week.sessionTargets !== 'number'))) {
    throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'Lộ trình AI thiếu số buổi tập mục tiêu của tuần.' });
  }
  if (constraints?.sessionDurationMinutes) {
    const budget = draft.strategy.sessionBudget as Record<string, number> | undefined;
    if (!budget || Object.values(budget).reduce((sum, minutes) => sum + minutes, 0) > constraints.sessionDurationMinutes) {
      throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'Phân bổ thời gian buổi tập thiếu hoặc vượt giới hạn PT yêu cầu.' });
    }
  }
  const n = draft.strategy.nutrition as Record<string, number>;
  const delta = n.targetCalories - n.tdee;
  const goal = constraints?.goalType;
  if ((['FITNESS', 'STRENGTH'].includes(goal || '') && delta !== 0) || (['FAT_LOSS', 'WEIGHT_LOSS'].includes(goal || '') && delta >= 0) || (['MUSCLE_GAIN', 'WEIGHT_GAIN'].includes(goal || '') && delta <= 0)) {
    throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'Chiến lược năng lượng không khớp mục tiêu PT: thể lực/sức mạnh duy trì năng lượng, giảm cân cần thâm hụt, tăng cân cần thặng dư.' });
  }
  if (constraints && (draft.strategy.estimatedWeeks !== constraints.durationWeeks || draft.strategy.sessionsPerWeek !== constraints.sessionsPerWeek)) {
    throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'Lộ trình AI không khớp số tuần hoặc tần suất PT yêu cầu.' });
  }
  return draft;
}
