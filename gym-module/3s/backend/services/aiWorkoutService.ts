import CustomerProfile from '../models/CustomerProfile.js';
import Goal from '../models/Goal.js';
import InBodyRecord from '../models/InBodyRecord.js';
import Exercise from '../models/Exercise.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { logger } from '../config/logger.js';
import { generateWorkoutDraft as generateWorkoutJson } from './aiProvider.js';
import {
  availabilityProposalDefaults,
  normalizeWorkoutSessionTimings,
  scheduleWorkoutSessions,
} from './workoutAvailabilityScheduler.js';
import { cleanExerciseName } from './aiExerciseService.js';
import type { AuthenticatedUser } from '../types/express.js';
import type { ClassifiedTrackingType, TrackingPrescription } from '../types/exerciseTracking.js';
import type { WorkoutAvailabilitySlot } from '../types/workoutAvailability.js';

export interface WorkoutProposal {
  durationWeeks: number;
  sessionsPerWeek: number;
  minutesPerSession: number;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  trainingMethod: string;
  trainingSplit: string;
  priorityMuscleGroups: string[];
  restrictions: string[];
}

export interface WorkoutGenerationInput {
  customerId: string;
  proposal: WorkoutProposal;
  availabilitySlots: WorkoutAvailabilitySlot[];
  additionalRequest?: string;
}

interface AiScheduledExercise {
  exerciseId?: string;
  generatedExerciseName?: string;
  weekNumber: number;
  dayNumber: number;
  startMinute: number;
  durationMinutes: number;
  prescription?: Record<string, unknown>;
}

interface AiGeneratedExercise {
  name: string;
  muscleGroup: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  defaultTrackingType: 'STRENGTH' | 'BODYWEIGHT' | 'CARDIO' | 'INTERVAL' | 'MOBILITY';
  equipment?: string[];
  description?: string;
  technique?: string;
  commonMistakes?: string[];
  contraindications?: string[];
  variants?: string[];
}

const classifiedTrackingTypes = ['STRENGTH', 'BODYWEIGHT', 'CARDIO', 'INTERVAL', 'MOBILITY'] as const;
const normalizeExerciseName = (value: unknown) => String(value || '').trim().toLocaleLowerCase('vi');

function normalizeLevel(level: unknown): 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' {
  const str = String(level || '').trim().toUpperCase();
  if (str.includes('BEGIN') || str.includes('MỚI') || str.includes('CƠ BẢN')) return 'BEGINNER';
  if (str.includes('ADVANC') || str.includes('NÂNG CAO')) return 'ADVANCED';
  return 'INTERMEDIATE';
}

const PRESCRIPTION_FIELD_NAMES: Record<string, string> = {
  targetWeight: 'mức tạ mục tiêu (kg)',
  addedWeight: 'mức tạ thêm (kg)',
  sets: 'số hiệp tập (sets)',
  reps: 'số lần lặp (reps)',
  restSeconds: 'thời gian nghỉ giữa hiệp',
  durationMinutes: 'thời lượng tập (phút)',
  rounds: 'số vòng tập (rounds)',
  workSeconds: 'thời gian tập mỗi vòng',
  targetRpe: 'chỉ số gắng sức (RPE)',
  targetRir: 'chỉ số RIR',
  side: 'bên tập (trái/phải/cả hai)',
  targetDiscomfort: 'mức độ căng cơ',
};

function parseNumberField(
  source: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  defaultValue?: number,
  integer = false,
) {
  const raw = source[key];
  if (raw === undefined || raw === null || raw === '') {
    if (defaultValue !== undefined) return defaultValue;
  }
  const parsed = Number(raw);
  if ((typeof raw !== 'number' && typeof raw !== 'string') || !Number.isFinite(parsed)
    || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    if (defaultValue !== undefined) return defaultValue;
    const fieldLabel = PRESCRIPTION_FIELD_NAMES[key] || key;
    throw new AppError({
      status: 502,
      code: ERROR_CODES.EXTERNAL,
      message: `AI gợi ý thông số bài tập chưa hợp lệ ở phần "${fieldLabel}".`,
    });
  }
  return parsed;
}

function parseRepsField(source: Record<string, unknown>, defaultValue = '10-12') {
  const raw = source.reps;
  const reps = typeof raw === 'number' || typeof raw === 'string' ? String(raw).trim() : '';
  if (!reps || reps.length > 100) {
    if (defaultValue) return defaultValue;
    throw new AppError({
      status: 502,
      code: ERROR_CODES.EXTERNAL,
      message: 'AI gợi ý thông số bài tập chưa hợp lệ ở phần "số lần lặp (reps)".',
    });
  }
  return reps;
}

function prescriptionFor(trackingType: ClassifiedTrackingType, value: unknown): TrackingPrescription {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError({
      status: 502,
      code: ERROR_CODES.EXTERNAL,
      message: `AI chưa tạo được thông số bài tập cho dạng bài ${trackingType}.`,
    });
  }
  const source = value as Record<string, unknown>;

  switch (trackingType) {
    case 'STRENGTH': return {
      sets: parseNumberField(source, 'sets', 1, 20, 3, true),
      reps: parseRepsField(source, '8-12'),
      targetWeight: parseNumberField(source, 'targetWeight', 0, 1_000, 0),
      targetRpe: parseNumberField(source, 'targetRpe', 0, 10, 7),
      targetRir: parseNumberField(source, 'targetRir', 0, 10, 2),
      restSeconds: parseNumberField(source, 'restSeconds', 0, 600, 90, true),
    };
    case 'BODYWEIGHT': return {
      sets: parseNumberField(source, 'sets', 1, 20, 3, true),
      reps: parseRepsField(source, '10-15'),
      addedWeight: parseNumberField(source, 'addedWeight', 0, 1_000, 0),
      targetRpe: parseNumberField(source, 'targetRpe', 0, 10, 7),
      targetRir: parseNumberField(source, 'targetRir', 0, 10, 2),
      restSeconds: parseNumberField(source, 'restSeconds', 0, 600, 60, true),
    };
    case 'CARDIO': return {
      durationMinutes: parseNumberField(source, 'durationMinutes', 1, 240, 30, true),
      targetRpe: parseNumberField(source, 'targetRpe', 0, 10, 6),
    };
    case 'INTERVAL': return {
      rounds: parseNumberField(source, 'rounds', 1, 100, 5, true),
      workSeconds: parseNumberField(source, 'workSeconds', 1, 3_600, 45, true),
      restSeconds: parseNumberField(source, 'restSeconds', 0, 3_600, 15, true),
      targetRpe: parseNumberField(source, 'targetRpe', 0, 10, 8),
    };
    case 'MOBILITY': {
      const side = String(source.side ?? '').toUpperCase();
      const validSide = ['LEFT', 'RIGHT', 'BOTH'].includes(side) ? (side as 'LEFT' | 'RIGHT' | 'BOTH') : 'BOTH';
      return {
        durationMinutes: parseNumberField(source, 'durationMinutes', 1, 240, 15, true),
        reps: parseNumberField(source, 'reps', 1, 1_000, 10, true),
        side: validSide,
        targetDiscomfort: parseNumberField(source, 'targetDiscomfort', 0, 10, 3),
      };
    }
  }
}

const exerciseLibraryFor = (_user: AuthenticatedUser) => Exercise.find({
  defaultTrackingType: { $in: classifiedTrackingTypes },
}).sort({ name: 1 }).limit(200).select('_id name muscleGroup level equipment defaultTrackingType').lean();
const exerciseCatalog = (library: Awaited<ReturnType<typeof exerciseLibraryFor>>) => library.map((exercise) => ({
  exerciseId: String(exercise._id), name: exercise.name, muscleGroup: exercise.muscleGroup,
  level: exercise.level, equipment: exercise.equipment, trackingType: exercise.defaultTrackingType,
}));

const availabilityPrompt = (slots: WorkoutAvailabilitySlot[]) => {
  const dayCount = new Set(slots.map((slot) => slot.dayNumber)).size;
  const defaults = availabilityProposalDefaults(slots);
  const durations = slots.map((slot) => (
    `ngày ${slot.dayNumber}: ${slot.endMinute - slot.startMinute} phút`
  )).join(', ');
  return `${dayCount} ngày rảnh, ${slots.length} khung giờ (${durations}). Cấu hình tự tính bắt buộc: ${defaults.sessionsPerWeek} buổi/tuần, ${defaults.minutesPerSession} phút/buổi. Dữ liệu: ${JSON.stringify(slots)}`;
};

function repairJson(str: string): string {
  let s = str.trim();
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && inString) {
      escaped = !escaped;
    } else if (c === '"' && !escaped) {
      inString = !inString;
    } else {
      escaped = false;
    }
  }
  if (inString) s += '"';
  s = s.replace(/,\s*$/, '');
  const openBrackets: string[] = [];
  inString = false;
  escaped = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && inString) {
      escaped = !escaped;
    } else if (c === '"' && !escaped) {
      inString = !inString;
    } else if (!inString) {
      if (c === '{' || c === '[') openBrackets.push(c);
      else if (c === '}' && openBrackets[openBrackets.length - 1] === '{') openBrackets.pop();
      else if (c === ']' && openBrackets[openBrackets.length - 1] === '[') openBrackets.pop();
    } else {
      escaped = false;
    }
  }
  while (openBrackets.length > 0) {
    const b = openBrackets.pop();
    s += b === '{' ? '}' : ']';
  }
  return s;
}

function extractJson(raw: string): any {
  const trimmed = raw.trim();
  try { return JSON.parse(trimmed); } catch {}

  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch {}
    try { return JSON.parse(repairJson(codeBlock[1].trim())); } catch {}
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)); } catch {}
    try { return JSON.parse(repairJson(trimmed.slice(firstBrace, lastBrace + 1))); } catch {}
  }

  if (firstBrace !== -1) {
    try { return JSON.parse(repairJson(trimmed.slice(firstBrace))); } catch {}
  }

  throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'AI không trả về dữ liệu hợp lệ.' });
}

function parseWorkoutJson(raw: string, requestKey: string) {
  try {
    return extractJson(raw);
  } catch (error) {
    logger.error({
      context: 'AI_WORKOUT_PARSE', requestKey,
      responseLength: raw.length,
      responseStart: raw.slice(0, 1_000),
      responseEnd: raw.length > 1_000 ? raw.slice(-1_000) : undefined,
      err: error,
    }, 'Không parse được JSON giáo án từ OpenRouter');
    throw error;
  }
}

function parseProposal(
  raw: string,
  defaults: Pick<WorkoutProposal, 'sessionsPerWeek' | 'minutesPerSession'>,
  requestKey: string,
): WorkoutProposal {
  let value: unknown;
  try { value = parseWorkoutJson(raw, requestKey); } catch { throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'AI không trả về đề xuất hợp lệ.' }); }
  const rawObj = (value && typeof value === 'object' ? value : {}) as Partial<WorkoutProposal>;
  const proposal = {
    ...rawObj,
    ...defaults,
  };
  const durationWeeks = Math.min(12, Math.max(1, Math.round(Number(proposal.durationWeeks) || 8)));
  const sessionsPerWeek = Math.min(7, Math.max(1, Math.round(Number(proposal.sessionsPerWeek) || defaults.sessionsPerWeek || 4)));
  const minutesPerSession = Math.min(240, Math.max(15, Math.round((Number(proposal.minutesPerSession) || defaults.minutesPerSession || 60) / 15) * 15));
  const level = normalizeLevel(proposal.level);
  const trainingMethod = typeof proposal.trainingMethod === 'string' && proposal.trainingMethod.trim() ? proposal.trainingMethod.trim() : 'Huấn luyện toàn diện';
  const trainingSplit = typeof proposal.trainingSplit === 'string' && proposal.trainingSplit.trim() ? proposal.trainingSplit.trim() : 'Toàn thân (Full Body)';
  const priorityMuscleGroups = Array.isArray(proposal.priorityMuscleGroups) ? proposal.priorityMuscleGroups.map(String) : [];
  const restrictions = Array.isArray(proposal.restrictions) ? proposal.restrictions.map(String) : [];
  return { durationWeeks, sessionsPerWeek, minutesPerSession, level, trainingMethod, trainingSplit, priorityMuscleGroups, restrictions };
}

export async function createWorkoutProposal(
  user: AuthenticatedUser,
  customerId: string,
  availabilitySlots: WorkoutAvailabilitySlot[],
  requestKey: string,
): Promise<WorkoutProposal> {
  const customer = await CustomerProfile.findOne({ _id: customerId, assignedPtId: user.id }).lean();
  if (!customer) throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Bạn không có quyền tạo giáo án cho học viên này.' });
  const [goal, inbody, library] = await Promise.all([
    Goal.findOne({ customerId: customer._id }).sort({ createdAt: -1 }).lean(),
    InBodyRecord.findOne({ customerId: customer._id }).sort({ measurementDate: -1, createdAt: -1 }).lean(),
    exerciseLibraryFor(user),
  ]);
  const proposalDefaults = availabilityProposalDefaults(availabilitySlots);
  const providerRequestKey = `${requestKey}:text-workout-proposal`;
  const raw = await generateWorkoutJson(
    { userId: user.id, taskType: 'TEXT_WORKOUT', requestKey: providerRequestKey },
    `Trả về duy nhất JSON đề xuất giáo án 1-12 tuần cho học viên ${customer.fullName}. Mục tiêu: ${goal?.title || customer.initialGoal || 'chưa có'}. InBody: ${inbody ? `cân nặng ${inbody.weight}, mỡ ${inbody.bodyFatPercentage ?? 'chưa có'}` : 'chưa có'}. Sức khỏe: ${customer.medicalNotes || 'không có'}. Khung giờ rảnh lặp lại mỗi tuần, dayNumber từ 1 đến 7 và thời gian tính bằng phút: ${availabilityPrompt(availabilitySlots)}. Mỗi ngày chỉ xếp tối đa một buổi tập; dùng đúng sessionsPerWeek và minutesPerSession đã được hệ thống tự tính. Hãy phân tích khả năng đáp ứng của thư viện bài tập hiện có của PT khi đề xuất phương pháp và lịch tập; ưu tiên các bài phù hợp trong thư viện, chỉ dự kiến tạo bài mới nếu thật sự thiếu. Thư viện: ${JSON.stringify(exerciseCatalog(library))}. JSON gồm durationWeeks, sessionsPerWeek, minutesPerSession, level, trainingMethod, trainingSplit, priorityMuscleGroups, restrictions.`
  );
  return parseProposal(raw, proposalDefaults, providerRequestKey);
}

export async function generateWorkoutDraft(user: AuthenticatedUser, input: WorkoutGenerationInput, requestKey: string) {
  const customer = await CustomerProfile.findOne({ _id: input.customerId, assignedPtId: user.id }).lean();
  if (!customer) throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Bạn không có quyền tạo giáo án cho học viên này.' });
  const proposal = input.proposal;
  if (proposal.durationWeeks < 1 || proposal.durationWeeks > 12) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Chu kỳ AI phải từ 1 đến 12 tuần.' });
  const library = await exerciseLibraryFor(user);
  const providerRequestKey = `${requestKey}:text-workout-draft`;
  const prescriptionInstruction = 'AI phải tự tính và trả về đầy đủ prescription cho từng scheduledExercises dựa trên mục tiêu, level, phương pháp tập và yêu cầu của PT; không được bỏ trường, trả null hoặc chuỗi rỗng. STRENGTH gồm sets, reps, targetWeight, targetRpe, targetRir, restSeconds; BODYWEIGHT gồm sets, reps, addedWeight, targetRpe, targetRir, restSeconds; CARDIO gồm durationMinutes, targetRpe; INTERVAL gồm rounds, workSeconds, restSeconds, targetRpe; MOBILITY gồm durationMinutes, reps, side (LEFT, RIGHT hoặc BOTH), targetDiscomfort. sets, rounds, thời lượng và số giây phải là số nguyên; RPE, RIR và discomfort từ 0 đến 10; trọng lượng không âm. Backend sẽ từ chối kết quả thiếu thông số và không tự điền giá trị mặc định.';
  const raw = await generateWorkoutJson(
    { userId: user.id, taskType: 'TEXT_WORKOUT', requestKey: providerRequestKey },
    `Trả về duy nhất JSON giáo án cho ${customer.fullName}: title, goal, level, durationWeeks, sessionsPerWeek, minutesPerSession, scheduledExercises, generatedExercises. Khung giờ rảnh lặp lại mỗi tuần, dayNumber từ 1 đến 7 và thời gian tính bằng phút: ${availabilityPrompt(input.availabilitySlots)}. Mỗi ngày chỉ có tối đa một buổi tập; ưu tiên xếp nguyên buổi vào một khung giờ rảnh đủ dài. Nếu lịch rảnh không đủ, vẫn tạo đầy đủ số buổi và hệ thống sẽ sắp lại, cảnh báo PT. Ưu tiên tối đa bài phù hợp trong thư viện. Bài có sẵn: scheduledExercises dùng exerciseId. Chỉ khi không có bài phù hợp mới tạo bài mới: thêm đầy đủ vào generatedExercises và scheduledExercises tham chiếu bằng generatedExerciseName trùng chính xác tên bài mới. Mỗi scheduledExercises gồm exerciseId hoặc generatedExerciseName (chỉ một trong hai), weekNumber (chỉ sinh tuần mẫu weekNumber: 1, hệ thống sẽ tự nhân bản cho toàn bộ ${proposal.durationWeeks} tuần), dayNumber, startMinute, durationMinutes và prescription. ${prescriptionInstruction} durationMinutes là thời lượng riêng của từng bài, không phải thời lượng cả buổi. Các bài cùng tuần và ngày phải nối tiếp nhau, không trùng giờ; tổng thời lượng của chúng không vượt quá ${proposal.minutesPerSession} phút. Mỗi generatedExercises gồm name, muscleGroup, level, defaultTrackingType, equipment, description, technique, commonMistakes, contraindications, variants; QUY TẮC BẮT BUỘC: name PHẢI 100% LÀ TIẾNG ANH CHUẨN quốc tế (ví dụ: "Barbell Bench Press", "Romanian Deadlift", "Lat Pulldown"...); TUYỆT ĐỐI KHÔNG chứa bất kỳ dấu ngoặc đơn () hay dấu ngoặc vuông [] hay {} nào trong tên bài tập (không mở ngoặc chú thích tiếng Việt, không ghi biến thể trong ngoặc), chỉ để duy nhất chuỗi text tiếng Anh thuần túy; defaultTrackingType chỉ là STRENGTH, BODYWEIGHT, CARDIO, INTERVAL hoặc MOBILITY. Ngày không có bài là ngày nghỉ hợp lệ. Thời gian dùng bước 15 phút và không trùng nhau. Cấu hình: ${JSON.stringify(proposal)}. Yêu cầu PT: ${input.additionalRequest || 'không có'}. Thư viện: ${JSON.stringify(exerciseCatalog(library))}.`
  );

  const draft = parseWorkoutJson(raw, providerRequestKey);
  if (!draft || typeof draft !== 'object') throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'AI không trả về giáo án hợp lệ.' });

  if (!Array.isArray(draft.scheduledExercises)) {
    draft.scheduledExercises = Array.isArray(draft.schedule)
      ? draft.schedule
      : Array.isArray(draft.exercises)
        ? draft.exercises
        : [];
  }
  if (!Array.isArray(draft.generatedExercises)) {
    draft.generatedExercises = Array.isArray(draft.newExercises)
      ? draft.newExercises
      : [];
  }

  draft.title = draft.title || `Giáo án ${proposal.trainingSplit} (${proposal.durationWeeks} tuần)`;
  draft.goal = draft.goal || customer.initialGoal || 'Cải thiện thể lực toàn diện';
  draft.durationWeeks = proposal.durationWeeks;
  draft.sessionsPerWeek = proposal.sessionsPerWeek;
  draft.minutesPerSession = proposal.minutesPerSession;
  draft.level = normalizeLevel(draft.level || proposal.level);

  const libraryById = new Map(library.map((exercise) => [String(exercise._id), exercise]));
  const libraryByName = new Map(library.map((exercise) => [normalizeExerciseName(exercise.name), exercise]));
  const generatedExercises = (draft.generatedExercises as AiGeneratedExercise[]).map((exercise) => {
    const name = cleanExerciseName(exercise?.name) || 'New Exercise';
    const muscleGroup = exercise?.muscleGroup?.trim() || 'Toàn thân';
    const level = normalizeLevel(exercise?.level);
    const defaultTrackingType = classifiedTrackingTypes.includes(exercise?.defaultTrackingType) ? exercise.defaultTrackingType : 'STRENGTH';
    return { name, muscleGroup, level, defaultTrackingType, equipment: Array.isArray(exercise.equipment) ? exercise.equipment : [], description: exercise.description || '', technique: exercise.technique || '', commonMistakes: Array.isArray(exercise.commonMistakes) ? exercise.commonMistakes : [], contraindications: Array.isArray(exercise.contraindications) ? exercise.contraindications : [], variants: Array.isArray(exercise.variants) ? exercise.variants : [] };
  }).filter((exercise) => !libraryByName.has(normalizeExerciseName(exercise.name)));
  const generatedByName = new Map(generatedExercises.map((exercise) => [normalizeExerciseName(exercise.name), exercise]));

  const scheduledExercises = (draft.scheduledExercises as AiScheduledExercise[]).map((item) => {
    const existingExercise = item.exerciseId ? libraryById.get(String(item.exerciseId)) : libraryByName.get(normalizeExerciseName(item.generatedExerciseName || (item as any).name));
    const generatedExercise = item.generatedExerciseName ? generatedByName.get(normalizeExerciseName(item.generatedExerciseName)) : undefined;
    const rawExerciseName = existingExercise?.name || generatedExercise?.name || item.generatedExerciseName || (item as any).name || 'Exercise';
    const exerciseName = existingExercise ? existingExercise.name : cleanExerciseName(rawExerciseName);
    const rawTrackingType = existingExercise?.defaultTrackingType || generatedExercise?.defaultTrackingType;
    const trackingType = classifiedTrackingTypes.includes(rawTrackingType as ClassifiedTrackingType)
      ? rawTrackingType as ClassifiedTrackingType
      : 'STRENGTH';
    const weekNumber = Math.min(proposal.durationWeeks, Math.max(1, Math.round(Number(item.weekNumber) || 1)));
    const dayNumber = Math.min(7, Math.max(1, Math.round(Number(item.dayNumber) || 1)));
    const startMinute = Math.min(1380, Math.max(0, Math.round((Number(item.startMinute) || 0) / 15) * 15));
    const durationMinutes = Math.min(1440 - startMinute, Math.max(15, Math.round((Number(item.durationMinutes) || 30) / 15) * 15));
    return {
      ...(existingExercise ? { exerciseId: String(existingExercise._id) } : {}),
      name: exerciseName,
      trackingType,
      prescription: prescriptionFor(trackingType, item.prescription),
      weekNumber,
      dayNumber,
      startMinute,
      durationMinutes,
    };
  });

  // Guard 1: Đảm bảo số ngày tập trong mỗi tuần không vượt quá proposal.sessionsPerWeek
  const exercisesByWeek = new Map<number, typeof scheduledExercises>();
  for (const ex of scheduledExercises) {
    exercisesByWeek.set(ex.weekNumber, [...(exercisesByWeek.get(ex.weekNumber) || []), ex]);
  }

  let cappedExercises: typeof scheduledExercises = [];
  for (const [, wExercises] of exercisesByWeek) {
    const distinctDays = Array.from(new Set(wExercises.map((e) => e.dayNumber)));
    if (distinctDays.length > proposal.sessionsPerWeek) {
      const allowedDays = new Set(distinctDays.slice(0, proposal.sessionsPerWeek));
      cappedExercises.push(...wExercises.filter((e) => allowedDays.has(e.dayNumber)));
    } else {
      cappedExercises.push(...wExercises);
    }
  }

  const normalizedExercises = normalizeWorkoutSessionTimings(
    cappedExercises,
    proposal.minutesPerSession,
  );
  const scheduled = scheduleWorkoutSessions(
    normalizedExercises,
    input.availabilitySlots,
    proposal.sessionsPerWeek,
  );

  return {
    ...draft,
    scheduledExercises: scheduled.scheduledExercises,
    availabilitySlots: input.availabilitySlots,
    scheduleWarnings: scheduled.scheduleWarnings,
    generatedExercises,
  };
}
