import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { getEnv } from '../config/env.js';
import { requestOpenRouter } from './openRouterRequest.js';
import { withAiBilling } from './aiBillingService.js';
import type { AiBillingContext, ProviderResult, ProviderUsage } from './creditTypes.js';

export interface InBodyExtraction {
  customerName?: string | null;
  measurementDate?: string | null;
  weight: number;
  height?: number | null;
  bmi?: number | null;
  bodyFatPercentage?: number | null;
  bodyFatMass?: number | null;
  muscleMass?: number | null;
  bmr?: number | null;
  visceralFatLevel?: number | null;
  inbodyScore?: number | null;
  bodyWater?: number | null;
  boneMineral?: number | null;
  waistHipRatio?: number | null;
  segmentalMuscle?: {
    rightArm?: number | null;
    leftArm?: number | null;
    trunk?: number | null;
    rightLeg?: number | null;
    leftLeg?: number | null;
  } | null;
  segmentalFat?: {
    rightArm?: number | null;
    leftArm?: number | null;
    trunk?: number | null;
    rightLeg?: number | null;
    leftLeg?: number | null;
  } | null;
  confidence: number;
  warnings: string[];
}

function extractContent(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || !('choices' in payload) || !Array.isArray(payload.choices)) return null;
  const choice = payload.choices[0];
  if (!choice || typeof choice !== 'object' || !('message' in choice)) return null;
  const message = choice.message;
  return message && typeof message === 'object' && 'content' in message && typeof message.content === 'string' ? message.content : null;
}

function normalizedUsage(usage: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown; cost?: unknown } | undefined): ProviderUsage {
  const integer = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
  const result: ProviderUsage = { inputTokens: integer(usage?.prompt_tokens), outputTokens: integer(usage?.completion_tokens), totalTokens: integer(usage?.total_tokens) };
  if (usage?.cost !== undefined) {
    const cost = Number(usage.cost);
    if (!Number.isFinite(cost) || cost < 0) throw new Error('OCR provider trả về chi phí không hợp lệ.');
    result.providerCostMicrousd = Math.round(cost * 1_000_000);
  }
  return result;
}

function normalizeInBodyWarning(warning: string): string {
  const w = warning.trim();
  const lower = w.toLowerCase();
  if (lower.includes('segmental fat') && lower.includes('estimated')) {
    return 'Chỉ số phân bố mỡ từng phần (tay, chân, thân) là giá trị ước tính từ thuật toán máy đo.';
  }
  if ((lower.includes('segmental lean') || lower.includes('segmental muscle')) && lower.includes('estimated')) {
    return 'Chỉ số phân bố cơ từng phần (tay, chân, thân) là giá trị ước tính từ thuật toán máy đo.';
  }
  if (lower.includes('ecw') && lower.includes('estimated')) {
    return 'Tỉ lệ nước ngoại bào (ECW/TBW) là số liệu ước tính từ điện trở kháng.';
  }
  if (lower.includes('body composition') && lower.includes('estimated')) {
    return 'Thành phần cơ thể là số liệu ước tính từ dòng điện sinh học BIA.';
  }
  if (lower.includes('impedance')) {
    return 'Dữ liệu trở kháng điện sinh học đo được từ các điện cực tiếp xúc.';
  }
  if (lower.includes('blurry') || lower.includes('blur') || lower.includes('unclear')) {
    return 'Ảnh chụp phiếu đo có vùng hơi mờ, PT vui lòng đối chiếu kỹ lại số đo trên phiếu gốc.';
  }
  if (lower.includes('confidence') && (lower.includes('low') || lower.includes('thấp'))) {
    return 'Độ nét của ảnh phiếu đo chưa cao, vui lòng rà soát lại các số liệu.';
  }
  return w;
}

async function extractInBodyRaw(fileOrFiles: Express.Multer.File | Express.Multer.File[]): Promise<ProviderResult<InBodyExtraction>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Dịch vụ OCR InBody chưa được cấu hình.' });
  const ocrModel = getEnv().OCR_MODEL;
  try {
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    const fileContents = files.map((file) => {
      const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
      return isPdf
        ? {
            type: 'file' as const,
            file: {
              filename: file.originalname || 'inbody.pdf',
              file_data: `data:application/pdf;base64,${file.buffer.toString('base64')}`,
            },
          }
        : {
            type: 'image_url' as const,
            image_url: { url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}` },
          };
    });

    const { data: payload } = await requestOpenRouter<{ usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown; cost?: unknown } }>('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ocrModel, temperature: 0,
        messages: [{ role: 'user', content: [
          {
            type: 'text',
            text: `Bạn là chuyên gia thị giác máy tính OCR phân tích phiếu đo thể trạng InBody (InBody 270, 370S, 570, 770, Tanita, Accuniq).
Hãy đọc kỹ hình ảnh hoặc tài liệu phiếu đo (nếu có nhiều ảnh hoặc nhiều trang, hãy tổng hợp thông tin từ tất cả các ảnh/trang của cùng phiếu đo) và trích xuất dữ liệu thành đúng 1 JSON object thuần túy theo cấu trúc sau:

1. customerName: Họ tên hoặc ID học viên/khách hàng in trên phiếu (thường ở góc trên cùng, gần nhãn 'ID', 'Name', 'User', 'Họ tên'). Ví dụ: "NGUYEN VAN AN". Hãy loại bỏ các tiền tố như "Name:", "ID:", "Sex:". Nếu không có tên hoặc không đọc được, trả về null.
2. measurementDate: Ngày đo trên phiếu (gần nhãn 'Test Date', 'Date / Time', 'Ngày đo'), chuẩn hóa về chuỗi định dạng YYYY-MM-DD. Nếu không thấy, trả về null.
3. weight: Cân nặng thực tế đo được (kg) - số dương. CHÚ Ý: Luôn lấy giá trị thực tế đo được (cột Current / Measured Value), tuyệt đối KHÔNG lấy cột khoảng chuẩn (Normal Range).
4. height: Chiều cao học viên in trên phiếu (cm, ví dụ: 170.1 hoặc 165). Nếu không thấy trả về null.
5. muscleMass: Khối lượng cơ xương (SMM - Skeletal Muscle Mass hoặc Muscle Mass) tính bằng kg. Nếu phiếu có SMM, luôn ưu tiên lấy SMM.
6. bodyFatMass: Khối lượng mỡ cơ thể (Body Fat Mass / BFM) tính bằng kg.
7. bodyFatPercentage: Phần trăm mỡ cơ thể (Percent Body Fat / PBF / %Fat), số thực từ 0 đến 100.
8. bmi: Chỉ số khối cơ thể (Body Mass Index / BMI).
9. bmr: Tỷ lệ trao đổi chất cơ bản (Basal Metabolic Rate / BMR) tính bằng kcal.
10. visceralFatLevel: Cấp độ mỡ nội tạng (Visceral Fat Level / VFL), thường là cấp độ từ 1 đến 20 (chú ý: nếu phiếu ghi diện tích mỡ nội tạng cm2, hãy quy đổi hoặc lấy cấp độ level).
11. inbodyScore: Điểm thể chất / InBody Score (thường từ 40 đến 100).
12. bodyWater: Tổng lượng nước cơ thể (Total Body Water / TBW) tính bằng Lít hoặc kg.
13. boneMineral: Khoáng chất trong xương (Bone Mineral Content / BMC) tính bằng kg.
14. waistHipRatio: Tỷ lệ eo/hông (Waist-Hip Ratio / WHR).
15. segmentalMuscle: Phân tích cơ từng phần (kg): { rightArm, leftArm, trunk, rightLeg, leftLeg }. Lấy số kg đo được, không lấy %.
16. segmentalFat: Phân tích mỡ từng phần (kg): { rightArm, leftArm, trunk, rightLeg, leftLeg }. Lấy số kg đo được.
17. confidence: Số thực từ 0.0 đến 1.0 đánh giá độ nét và độ tin cậy của ảnh.
18. warnings: Mảng chuỗi tiếng Việt lưu ý nếu có chỉ số mờ, bị che khuất hoặc là giá trị ước tính.

LƯU Ý: Nếu chỉ số nào không có trên phiếu, hãy gán null. Chỉ trả về JSON thuần túy, không kèm bất kỳ giải thích nào.`,
          },
          ...fileContents,
        ] }],
      }),
    }, getEnv().PROVIDER_TIMEOUT_MS);
    const content = extractContent(payload);
    const match = content?.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('OCR provider không trả JSON hợp lệ');
    const parsed = JSON.parse(match[0]) as InBodyExtraction;
    if (!Number.isFinite(parsed.weight) || parsed.weight <= 0) throw new Error('OCR không đọc được cân nặng hợp lệ');

    // Parse and sanitize confidence into [0, 1] range
    let rawConf = typeof parsed.confidence === 'number' ? parsed.confidence : parseFloat(String(parsed.confidence || '0.85'));
    if (!Number.isFinite(rawConf)) rawConf = 0.85;
    if (rawConf > 1 && rawConf <= 100) rawConf = rawConf / 100;
    const confidence = Math.min(Math.max(rawConf, 0), 1);

    const numOrNull = (val: unknown, min = 0, max = Infinity): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const n = Number(val);
      if (!Number.isFinite(n) || n < min || n > max) return null;
      return n;
    };

    const sanitizeSegment = (seg: unknown) => {
      if (!seg || typeof seg !== 'object') return null;
      const s = seg as Record<string, unknown>;
      return {
        rightArm: numOrNull(s.rightArm),
        leftArm: numOrNull(s.leftArm),
        trunk: numOrNull(s.trunk),
        rightLeg: numOrNull(s.rightLeg),
        leftLeg: numOrNull(s.leftLeg),
      };
    };

    const customerName = typeof parsed.customerName === 'string' && parsed.customerName.trim()
      ? parsed.customerName.trim()
      : null;

    let measurementDate: string | null = null;
    if (typeof parsed.measurementDate === 'string' && parsed.measurementDate.trim()) {
      const parsedDate = Date.parse(parsed.measurementDate.trim());
      if (!Number.isNaN(parsedDate)) {
        measurementDate = new Date(parsedDate).toISOString().slice(0, 10);
      }
    }

    const value: InBodyExtraction = {
      customerName,
      measurementDate,
      weight: Number(parsed.weight),
      height: numOrNull(parsed.height),
      bmi: numOrNull(parsed.bmi),
      bodyFatPercentage: numOrNull(parsed.bodyFatPercentage, 0, 100),
      bodyFatMass: numOrNull(parsed.bodyFatMass),
      muscleMass: numOrNull(parsed.muscleMass),
      bmr: numOrNull(parsed.bmr),
      visceralFatLevel: numOrNull(parsed.visceralFatLevel),
      inbodyScore: numOrNull(parsed.inbodyScore, 0, 100),
      bodyWater: numOrNull(parsed.bodyWater),
      boneMineral: numOrNull(parsed.boneMineral),
      waistHipRatio: numOrNull(parsed.waistHipRatio),
      segmentalMuscle: sanitizeSegment(parsed.segmentalMuscle),
      segmentalFat: sanitizeSegment(parsed.segmentalFat),
      confidence,
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.filter((w): w is string => typeof w === 'string').map(normalizeInBodyWarning)
        : [],
    };
    return { value, provider: 'openrouter', model: ocrModel, usage: normalizedUsage(payload.usage) };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError({ status: 502, code: ERROR_CODES.EXTERNAL, message: 'Không thể đọc phiếu InBody. Vui lòng nhập thủ công hoặc thử lại.', cause: error });
  }
}

export function extractInBody(context: AiBillingContext, file: Express.Multer.File | Express.Multer.File[]): Promise<InBodyExtraction>;
export function extractInBody(file: Express.Multer.File | Express.Multer.File[]): Promise<InBodyExtraction>;
export async function extractInBody(context: AiBillingContext | Express.Multer.File | Express.Multer.File[], file?: Express.Multer.File | Express.Multer.File[]): Promise<InBodyExtraction> {
  if (Array.isArray(context) || 'buffer' in context) return (await extractInBodyRaw(context)).value;
  return withAiBilling(context as AiBillingContext, () => extractInBodyRaw(file!));
}
