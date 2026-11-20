import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { parseRoadmapDraftShape, validateRoadmapDraft, type RoadmapConstraints } from './roadmapValidation.js';

export interface RoadmapPromptContext {
  customer: { fullName: string; gender?: string; dateOfBirth?: Date | null; height?: number | null; initialWeight?: number | null; medicalNotes?: string };
  inbody: { weight?: number; bodyFatPercentage?: number; muscleMass?: number; bmr?: number; visceralFatLevel?: number; inbodyScore?: number } | null;
  goal: { title?: string; type?: string; targetValue?: number; targetUnit?: string } | null;
  request: string;
  constraints?: RoadmapConstraints;
  now?: Date;
}

export function ageAt(dateOfBirth: Date | null | undefined, now: Date): number | null {
  if (!dateOfBirth || !Number.isFinite(dateOfBirth.getTime()) || dateOfBirth > now) return null;
  const age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear() - Number(now.getUTCMonth() < dateOfBirth.getUTCMonth() || (now.getUTCMonth() === dateOfBirth.getUTCMonth() && now.getUTCDate() < dateOfBirth.getUTCDate()));
  return age >= 0 && age <= 120 ? age : null;
}

export function buildRoadmapPrompt({ customer, inbody, goal, request, constraints, now = new Date() }: RoadmapPromptContext) {
  const age = ageAt(customer.dateOfBirth, now);
  const baseline: Record<string, number> = {};
  const measured = { initialWeight: inbody?.weight ?? customer.initialWeight, initialBodyFat: inbody?.bodyFatPercentage, initialMuscleMass: inbody?.muscleMass };
  for (const [key, value] of Object.entries(measured)) if (typeof value === 'number' && Number.isFinite(value) && value > 0) baseline[key] = value;

  const exampleDuration = constraints?.durationWeeks ?? 12;
  const exampleFrequency = constraints?.sessionsPerWeek ?? 3;
  const example = {
    title: 'Tên lộ trình theo mục tiêu của học viên',
    strategy: {
      targetSummary: 'Mục tiêu cụ thể', estimatedWeeks: exampleDuration, sessionsPerWeek: exampleFrequency,
      ...(constraints?.sessionDurationMinutes ? { sessionBudget: { warmupMinutes: 5, strengthMinutes: Math.max(1, constraints.sessionDurationMinutes - 20), cardioMinutes: Math.min(10, constraints.sessionDurationMinutes - 11), cooldownMinutes: 5 } } : {}),
      trainingMethod: 'Phương pháp tập phù hợp hồ sơ', trainingSplit: 'Phân chia lịch tập',
      cardioProtocol: 'Chiến lược cardio phù hợp', assumptions: ['Liệt kê dữ liệu thiếu và giả định thực sự sử dụng'],
      nutrition: { bmr: 1600, tdee: 2200, targetCalories: 1800, calorieDeficitOrSurplus: -400,
        proteinGrams: 140, carbsGrams: 198, fatGrams: 50, waterLiters: 2.8, advice: 'Giải thích chỉ tiêu và giả định' },
      checkpoints: [{ week: exampleDuration, title: 'Đánh giá cuối chu kỳ', description: 'Tiêu chí đánh giá cụ thể' }],
    },
    phases: Array.from({ length: 3 }, (_, index) => {
      const start = Math.floor(exampleDuration / 3) * index;
      const duration = index === 2 ? exampleDuration - start : Math.floor(exampleDuration / 3);
      return { order: index + 1, name: `Giai đoạn ${index + 1}`, durationWeeks: duration,
        goals: ['Mục tiêu giai đoạn'], weeks: Array.from({ length: duration }, (_, i) => ({
          week: start + i + 1, focus: 'Trọng tâm cụ thể của tuần, không dùng câu chung lặp lại', sessionTargets: exampleFrequency,
        })) };
    }),
    baseline,
  };

  const prompt = `Bạn là Chuyên gia Khoa học Thể thao & Huấn luyện viên thể hình 3S Wellness Fitness & Yoga.
Hãy tạo Lộ trình huấn luyện (Roadmap) và Mục tiêu toàn diện dạng JSON cho học viên:
- Ngày đánh giá: ${now.toISOString().slice(0, 10)}. Tuổi do hệ thống tính: ${age ?? "chưa xác định"}. Không tự tính lại hoặc ghi tuổi giả định trong tiêu đề.
- Học viên: ${customer.fullName}, Giới tính: ${customer.gender || 'Chưa có'}, Ngày sinh: ${customer.dateOfBirth?.toISOString().slice(0, 10) || 'Chưa có'}, Chiều cao: ${customer.height || 'Chưa có'}cm, Cân nặng ban đầu: ${customer.initialWeight || 'Chưa có'}kg
- Tiền sử chấn thương / Sức khỏe: ${customer.medicalNotes || 'Không có'}
- Dữ liệu InBody gần nhất: ${inbody ? `Cân nặng ${inbody.weight}kg, % Mỡ ${inbody.bodyFatPercentage || '--'}%, Cơ ${inbody.muscleMass || '--'}kg, Mỡ nội tạng Level ${inbody.visceralFatLevel || '--'}, BMR ${inbody.bmr || '--'} kcal, Điểm InBody ${inbody.inbodyScore || '--'}đ` : 'Chưa có dữ liệu InBody'}
- Mục tiêu đã lưu: ${goal ? `${goal.title} (${goal.type}): ${goal.targetValue} ${goal.targetUnit || 'kg'}` : 'Chưa có'}
- Yêu cầu và mục tiêu từ PT: ${request}
- Thời lượng và tần suất bắt buộc: ${constraints ? `${constraints.durationWeeks} tuần, ${constraints.sessionsPerWeek} buổi/tuần` : "Theo yêu cầu PT"}

RÀNG BUỘC CÓ CẤU TRÚC TỪ PT (ưu tiên hơn mục tiêu đã lưu):
${JSON.stringify(constraints || {})}
Giới hạn buổi tập: ${constraints?.sessionDurationMinutes ?? 'Theo ghi chú PT'} phút. sessionBudget là phân bổ phút áp dụng cho MỌI tuần, gồm khởi động, kháng lực, cardio, hồi phục. Tổng không vượt giới hạn; không tăng thời gian cardio ở focus tuần vượt sessionBudget.
Nếu goalType là FITNESS hoặc STRENGTH: targetCalories phải bằng tdee, không tự tạo thâm hụt hay mục tiêu giảm cân. Nếu WEIGHT_LOSS/FAT_LOSS: thâm hụt; WEIGHT_GAIN/MUSCLE_GAIN: thặng dư. Không tự thêm mục tiêu điểm InBody, % mỡ hoặc đổi giảm kg cân nặng thành giảm kg mỡ.

QUY TẮC BẮT BUỘC:
1. Trả về DUY NHẤT 1 JSON object hợp lệ, không kèm markdown giải thích ngoài JSON.
2. Chia lộ trình thành các Phase liên tục, mỗi Phase bao gồm danh sách mục tiêu giai đoạn (goals: string[]) và đầy đủ tất cả các tuần theo thứ tự từ 1 đến hết thời lượng (Ví dụ Lộ trình 12 tuần: Phase 1 gồm tuần 1, 2, 3, 4; Phase 2 gồm tuần 5, 6, 7, 8; Phase 3 gồm tuần 9, 10, 11, 12).
3. Mỗi tuần có trọng tâm & mục tiêu tuần (focus) và số buổi tập mục tiêu/tuần (sessionTargets).
5. Không tự điền số đo thiếu vào baseline. Các giả định dùng để ước lượng dinh dưỡng phải liệt kê trong strategy.assumptions (string[]). Ưu tiên yêu cầu PT hiện tại hơn mục tiêu cũ.
6. Tổng durationWeeks của các phase phải bằng strategy.estimatedWeeks. Checkpoint tăng dần và nằm trong lộ trình. targetCalories = tdee + calorieDeficitOrSurplus; năng lượng macro (4*protein + 4*carbs + 9*fat) phải khớp targetCalories trong sai số 20 kcal.
7. Toàn bộ phases.goals và weeks.focus chỉ mô tả trọng tâm chiến lược, mức độ thích nghi, tiêu chí tiến triển và phục hồi. KHÔNG ghi tên bài tập cụ thể, ví dụ bài tập, số hiệp/reps, thời gian nghỉ. Kể cả squat, deadlift, lunge, plank, push-up, row cũng thuộc Giáo án riêng.
8. nutrition.advice và assumptions chỉ giải thích định tính, không lặp lại số gam macro/calo: hệ thống sẽ tính carbs từ calo còn lại và tính lại mức thâm hụt. Chọn targetCalories, proteinGrams, fatGrams sao cho phần năng lượng còn lại cho carbs không âm. Không giả định % mỡ hoặc khối cơ khi không có InBody.
9. Tuân thủ giới hạn và các hoạt động bị PT cấm trong request/medicalNotes. Không khẳng định loại bỏ triệu chứng đau hoặc đảm bảo kết quả. Mỗi tuần có trọng tâm cụ thể khác nhau nhưng không lập giáo án bài tập.

Cấu trúc mẫu bên dưới có đủ tuần. Thay nội dung và chỉ tiêu mẫu bằng phân tích học viên, có thể phân chia lại các phase nhưng phải giữ đúng tổng thời lượng:
${JSON.stringify(example)}`;

  return { prompt, baseline, age };
}

/** Arithmetic belongs to code; do not silently alter calorie targets or protein/fat choices. */
export function balanceRoadmapNutrition(value: unknown) {
  const draft = parseRoadmapDraftShape(value);
  const n = draft.strategy.nutrition as Record<string, number | string>;
  const calories = Number(n.targetCalories);
  const remaining = calories - Number(n.proteinGrams) * 4 - Number(n.fatGrams) * 9;
  if (remaining < 0) throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'Protein và fat vượt ngân sách calo; cần AI chọn lại chỉ tiêu.' });
  n.carbsGrams = Math.round(remaining / 4);
  n.calorieDeficitOrSurplus = calories - Number(n.tdee);
  // Replace numeric prose rather than leave stale values from the raw response.
  n.advice = `Chỉ tiêu ước lượng: ${calories} kcal/ngày; protein ${n.proteinGrams} g, carbs ${n.carbsGrams} g, fat ${n.fatGrams} g. ${Number(n.calorieDeficitOrSurplus) === 0 ? 'Duy trì năng lượng bằng TDEE ước lượng.' : `Chênh lệch so với TDEE: ${n.calorieDeficitOrSurplus} kcal/ngày.`} PT cần theo dõi và điều chỉnh theo tiến triển thực tế.`;
  return draft;
}

// A targeted guard for the exercise leakage observed in live tests, not a clinical safety classifier.
const exerciseNames = /\b(?:squats?|deadlifts?|lunges?|planks?|push[ -]?ups?|pull[ -]?ups?|bench press|goblet squat|glute bridge|hip hinge|step[ -]?up|bird dog|dead bug|row|rows)\b|chống đẩy|hít đất|gập bụng|nâng chân/iu;
interface NarrativeIssue { path: string[]; text: string; reason: string }
function narrativeIssues(draft: ReturnType<typeof validateRoadmapDraft>, age: number | null, constraints?: RoadmapConstraints): NarrativeIssue[] {
  const issues: NarrativeIssue[] = [];
  const visit = (value: unknown, path: string[]) => {
    if (typeof value === 'string') {
      const reasons: string[] = [];
      if (path[0] === 'phases' && exerciseNames.test(value)) reasons.push('còn chứa tên bài tập cụ thể; chỉ giữ trọng tâm chiến lược');
      if (path[0] === 'phases' && /\d+(?:\s*[-–]\s*\d+)?\s*(?:hiệp|reps?|sets?)\b/iu.test(value)) reasons.push('còn ghi số hiệp/reps; chỉ mô tả tiến triển định tính');
      if (constraints?.goalType === 'WEIGHT_LOSS' && /\d+(?:[.,]\d+)?\s*kg\s*(?:mỡ|fat)/iu.test(value)) reasons.push('PT yêu cầu giảm kg cân nặng, không phải kg mỡ');
      if (age !== null && [...value.matchAll(/(\d{1,3})\s*tuổi/gu)].some(match => Number(match[1]) !== age)) reasons.push(`tuổi đúng là ${age}, không tự tính lại`);
      if (reasons.length) issues.push({ path, text: value, reason: reasons.join('; ') });
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) visit(child, [...path, key]);
    }
  };
  visit(draft, []);
  return issues;
}
export function assertRoadmapNarrative(draft: ReturnType<typeof validateRoadmapDraft>, age: number | null, constraints?: RoadmapConstraints) {
  const issues = narrativeIssues(draft, age, constraints);
  if (issues.length) throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: issues.map(issue => `${issue.path.join('.')}: ${issue.reason}`).join(' '), details: issues });
}

function applyNarrativeReplacements(draft: ReturnType<typeof validateRoadmapDraft>, issues: NarrativeIssue[], response: unknown) {
  const replacements = response && typeof response === 'object' && 'replacements' in response ? response.replacements : null;
  if (!Array.isArray(replacements) || replacements.length !== issues.length || replacements.some(text => typeof text !== 'string' || !text.trim() || text.length > 5000)) {
    throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'AI phải trả đủ câu thay thế, đúng thứ tự, trong replacements: string[].' });
  }
  // Paths are generated locally from the validated draft; no model-provided paths are accepted.
  issues.forEach((issue, index) => {
    let parent: any = draft;
    for (const key of issue.path.slice(0, -1)) parent = parent[key];
    parent[issue.path[issue.path.length - 1]] = replacements[index].trim();
  });
  return draft;
}

/** At most one content repair. Transport/auth/credit errors are never treated as invalid content. */
export async function generateValidatedRoadmap(
  prompt: string, constraints: RoadmapConstraints | undefined, age: number | null,
  invoke: (prompt: string, attempt: number) => Promise<string>, signal?: AbortSignal,
) {
  let nextPrompt = prompt;
  let narrativeRepair: { draft: ReturnType<typeof validateRoadmapDraft>; issues: NarrativeIssue[] } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    signal?.throwIfAborted();
    const raw = await invoke(nextPrompt, attempt);
    signal?.throwIfAborted();
    let draft: ReturnType<typeof validateRoadmapDraft> | undefined;
    try {
      draft = balanceRoadmapNutrition(narrativeRepair ? applyNarrativeReplacements(narrativeRepair.draft, narrativeRepair.issues, JSON.parse(raw)) : JSON.parse(raw));
      const validated = validateRoadmapDraft(draft, constraints);
      assertRoadmapNarrative(validated, age, constraints);
      return validated;
    } catch (error) {
      if (attempt === 1) throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'AI chưa tạo được lộ trình đạt kiểm tra sau một lần sửa. ' + (error instanceof Error ? error.message : 'Đầu ra không hợp lệ.'), cause: error });
      if (draft && error instanceof AppError && Array.isArray(error.details)) {
        const issues = error.details as NarrativeIssue[];
        narrativeRepair = { draft, issues };
        nextPrompt = `Bạn biên tập roadmap tập luyện, không lập giáo án. Viết lại CHỈ các câu dưới đây để sửa lỗi đã chỉ rõ. Không ghi tên bài tập, số hiệp/reps, số bài, phần trăm tăng tạ hay thời gian nghỉ. Giữ mục đích của câu, dùng diễn đạt định tính về thích nghi, kỹ thuật, tiến triển hoặc phục hồi. Mục tiêu cân nặng không được đổi thành khối lượng mỡ. Không thêm mục tiêu mới.\nTrả DUY NHẤT JSON {"replacements":["câu thay thế thứ nhất", "..."]}, đúng ${issues.length} chuỗi, đúng thứ tự, không trường khác.\n${JSON.stringify(issues.map(({ text, reason }, index) => ({ index, text, error: reason })))}\nRàng buộc PT: ${JSON.stringify(constraints || {})}`;
        continue;
      }
      nextPrompt = `${prompt}\n\nLẦN TẠO LẠI DUY NHẤT: Kết quả trước bị từ chối. Viết lại toàn bộ JSON từ yêu cầu gốc; không sao chép nội dung tuần cũ.\nCác lỗi bắt buộc khắc phục: ${error instanceof Error ? error.message : 'JSON không hợp lệ'}\nMỗi focus chỉ 1-2 câu ngắn về thích nghi, kỹ thuật, đánh giá hoặc phục hồi. Không ghi số hiệp, reps, số bài, phần trăm tăng tạ hoặc thời gian nghỉ. Số buổi ở sessionTargets; thời gian ở sessionBudget. Mục tiêu giảm kg cân nặng không đồng nghĩa giảm kg mỡ.`;
    }
  }
  throw new Error('Unreachable roadmap generation state');
}
