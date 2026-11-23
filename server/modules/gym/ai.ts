import { ObjectId } from "mongodb";
import sharp from "sharp";
import { withAiUsage } from "../../service/ai-usage.service";
import {
  openrouterChat,
  type OpenRouterContentPart,
} from "../../service/openrouter.service";
import { ValidationError } from "../../errors/app-error";
import { customerFilter, tenantFilter, type GymActor } from "./access";
import { records } from "./store";

function gymAiModel() {
  return (
    process.env.CHATBOT_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    "google/gemini-2.5-flash"
  );
}

function parseJsonObject(text: string): Record<string, any> {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  try {
    const parsed = JSON.parse(slice);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, any>;
    }
  } catch {
    // fall through
  }
  throw new Error("AI trả về dữ liệu chưa đúng định dạng. Vui lòng thử lại.");
}

function toOptionalNumber(value: unknown, max = 100000): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) return undefined;
  return Math.round(n * 100) / 100;
}

function todayIso() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function addDaysIso(startIso: string, days: number) {
  const base = Number.isFinite(Date.parse(startIso))
    ? new Date(`${startIso.slice(0, 10)}T00:00:00Z`)
    : new Date();
  base.setUTCDate(base.getUTCDate() + Math.max(0, days));
  return base.toISOString().slice(0, 10);
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const VIETNAMESE_DIACRITICS =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

/** Ported from 3S-Gym aiExerciseService.ts: enforce pure English exercise name without brackets. */
export function cleanExerciseName(value: unknown): string {
  let name = typeof value === "string" ? value.trim() : "";
  if (!name) return "";

  const vnWithEnMatch = name.match(/^([^({\x5B]+)\s*[([{]([^)\]}]+)[)\]}]/);
  if (vnWithEnMatch) {
    const outerPart = vnWithEnMatch[1].trim();
    const insidePart = vnWithEnMatch[2].trim();
    if (
      VIETNAMESE_DIACRITICS.test(outerPart) &&
      !VIETNAMESE_DIACRITICS.test(insidePart) &&
      insidePart.length > 1
    ) {
      name = insidePart;
    }
  }

  const stripped = name
    .replace(/\s*\([^)]*\)/g, " ")
    .replace(/\s*\[[^\]]*\]/g, " ")
    .replace(/\s*\{[^}]*\}/g, " ")
    .trim();

  if (stripped.length > 0) name = stripped;
  name = name.replace(/[()[\]{}]/g, "").replace(/\s+/g, " ").trim();
  return name;
}

/** Ported from 3S-Gym aiExerciseValidator.ts: parse quantity 1-10 from Vietnamese prompt. */
function parseExerciseQuantity(prompt: string, explicitQty?: unknown): number {
  const nExplicit = Number(explicitQty);
  if (Number.isInteger(nExplicit) && nExplicit >= 1 && nExplicit <= 10) {
    return nExplicit;
  }
  const digitMatch = prompt.match(/\b(\d{1,2})\s*(?:bài|bai|động tác|dong tac|exercises?)\b/i);
  if (digitMatch) {
    const n = Number(digitMatch[1]);
    if (n >= 1 && n <= 10) return n;
    if (n > 10) {
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Mỗi lần AI chỉ tạo tối đa 10 bài tập. Vui lòng nhập số lượng từ 1 đến 10.",
      );
    }
  }
  const wordMap: Record<string, number> = {
    một: 1, mot: 1, hai: 2, ba: 3, bốn: 4, bon: 4, năm: 5, nam: 5,
    sáu: 6, sau: 6, bảy: 7, bay: 7, tám: 8, tam: 8, chín: 9, chin: 9, mười: 10, muoi: 10,
  };
  const wordMatch = prompt
    .toLowerCase()
    .match(/\b(một|mot|hai|ba|bốn|bon|năm|nam|sáu|sau|bảy|bay|tám|tam|chín|chin|mười|muoi)\s+(?:bài|bai|động tác|dong tac)/i);
  if (wordMatch && wordMap[wordMatch[1]]) return wordMap[wordMatch[1]];
  return 1;
}

const AI_FACTUAL_RULE =
  "NGUYÊN TẮC PHÂN TÍCH BẮT BUỘC: Chỉ sử dụng đúng thông tin thực tế của học viên được cung cấp. Các chỉ số không có dữ liệu (chiều cao, cân nặng, giới tính, tuổi, % mỡ, InBody, bệnh lý/chấn thương...) phải để trống hoặc ghi nhận là chưa có dữ liệu; TUYỆT ĐỐI không tự bịa số liệu hay suy đoán sai lệch.";

function calcAgeFromDob(dob: unknown): number | null {
  if (typeof dob !== "string" || !dob.trim()) return null;
  const parsed = Date.parse(dob);
  if (!Number.isFinite(parsed)) return null;
  const now = new Date();
  const birth = new Date(parsed);
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  return age > 0 && age < 120 ? age : null;
}

async function loadCustomerAiContext(
  actor: GymActor,
  rawCustomerId: unknown,
  options: { required: boolean },
) {
  const customerId =
    typeof rawCustomerId === "string" && /^[a-f0-9]{24}$/i.test(rawCustomerId.trim())
      ? rawCustomerId.trim()
      : "";

  if (!customerId) {
    if (options.required) {
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Vui lòng chọn học viên trước khi để AI phân tích và tạo kế hoạch cá nhân hóa.",
      );
    }
    return null;
  }

  const customer = await records("customers").findOne({
    ...customerFilter(actor),
    _id: customerId,
  });
  if (!customer) {
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Không tìm thấy học viên hoặc bạn không có quyền truy cập học viên này.",
    );
  }

  const [latestMeasurement, activeGoals] = await Promise.all([
    records("measurements")
      .find({ ...tenantFilter(actor), customerId })
      .sort({ measurementDate: -1, createdAt: -1 })
      .limit(1)
      .toArray()
      .then((rows) => rows[0] || null),
    records("goals")
      .find({ ...tenantFilter(actor), customerId })
      .sort({ targetDate: 1, createdAt: -1 })
      .limit(3)
      .toArray(),
  ]);

  const age = calcAgeFromDob(customer.dateOfBirth);
  const genderLabel =
    customer.gender === "MALE"
      ? "Nam"
      : customer.gender === "FEMALE"
        ? "Nữ"
        : "";
  const heightVal = latestMeasurement?.height ?? customer.height;
  const weightVal = latestMeasurement?.weight ?? customer.initialWeight;

  const baseline: Record<string, number> = {};
  if (typeof weightVal === "number" && weightVal > 0) baseline.initialWeight = weightVal;
  if (typeof latestMeasurement?.bodyFatPercentage === "number" && latestMeasurement.bodyFatPercentage > 0) {
    baseline.initialBodyFat = latestMeasurement.bodyFatPercentage;
  }
  if (typeof latestMeasurement?.muscleMass === "number" && latestMeasurement.muscleMass > 0) {
    baseline.initialMuscleMass = latestMeasurement.muscleMass;
  }

  const lines: string[] = [
    `- Họ tên học viên: ${customer.fullName || ""}`,
    `- Giới tính: ${genderLabel || "(chưa có dữ liệu — để trống)"}`,
    `- Tuổi (hệ thống tính): ${age != null ? `${age} tuổi` : "(chưa có dữ liệu — để trống)"}`,
    `- Chiều cao: ${typeof heightVal === "number" && heightVal > 0 ? `${heightVal} cm` : "(chưa có dữ liệu — để trống)"}`,
    `- Cân nặng: ${typeof weightVal === "number" && weightVal > 0 ? `${weightVal} kg` : "(chưa có dữ liệu — để trống)"}`,
    `- Mục tiêu ban đầu: ${String(customer.initialGoal || "").trim() || "(chưa có dữ liệu — để trống)"}`,
    `- Tiền sử chấn thương / lưu ý sức khỏe: ${String(customer.medicalNotes || "").trim() || "Không có"}`,
  ];

  if (latestMeasurement) {
    const inbodyParts = [
      latestMeasurement.measurementDate && `Ngày đo: ${String(latestMeasurement.measurementDate).slice(0, 10)}`,
      latestMeasurement.weight != null && `Cân nặng: ${latestMeasurement.weight} kg`,
      latestMeasurement.bmi != null && `BMI: ${latestMeasurement.bmi}`,
      latestMeasurement.bodyFatPercentage != null && `% Mỡ: ${latestMeasurement.bodyFatPercentage}%`,
      latestMeasurement.muscleMass != null && `Cơ xương: ${latestMeasurement.muscleMass} kg`,
      latestMeasurement.visceralFatLevel != null && `Mỡ nội tạng: Level ${latestMeasurement.visceralFatLevel}`,
      latestMeasurement.bmr != null && `BMR: ${latestMeasurement.bmr} kcal`,
      latestMeasurement.inbodyScore != null && `Điểm InBody: ${latestMeasurement.inbodyScore}/100`,
    ].filter(Boolean);
    lines.push(`- Chỉ số InBody gần nhất: ${inbodyParts.join(", ")}`);
  } else {
    lines.push("- Chỉ số InBody gần nhất: Chưa có dữ liệu InBody");
  }

  if (activeGoals.length) {
    const goalText = activeGoals
      .map((g) => {
        const parts = [
          g.title,
          g.targetWeight != null && `cân nặng mục tiêu ${g.targetWeight}kg`,
          g.targetBodyFat != null && `% mỡ mục tiêu ${g.targetBodyFat}%`,
          g.targetDate && `hạn ${String(g.targetDate).slice(0, 10)}`,
        ].filter(Boolean);
        return parts.join(" — ");
      })
      .join("; ");
    lines.push(`- Mục tiêu đang theo dõi: ${goalText}`);
  }

  return {
    customerId,
    customer,
    latestMeasurement,
    activeGoals,
    age,
    baseline,
    promptBlock: `HỒ SƠ HỌC VIÊN THỰC TẾ:\n${lines.join("\n")}\n\n${AI_FACTUAL_RULE}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. INBODY OCR (Ported from 3S-Gym ocrProvider.ts + inbodyOcrService.ts)
// ─────────────────────────────────────────────────────────────────────────────

function normalizeInBodyWarning(warning: string): string {
  const w = warning.trim();
  const lower = w.toLowerCase();
  if (lower.includes("segmental fat") && lower.includes("estimated")) {
    return "Chỉ số phân bố mỡ từng phần (tay, chân, thân) là giá trị ước tính từ thuật toán máy đo.";
  }
  if ((lower.includes("segmental lean") || lower.includes("segmental muscle")) && lower.includes("estimated")) {
    return "Chỉ số phân bố cơ từng phần (tay, chân, thân) là giá trị ước tính từ thuật toán máy đo.";
  }
  if (lower.includes("ecw") && lower.includes("estimated")) {
    return "Tỉ lệ nước ngoại bào (ECW/TBW) là số liệu ước tính từ điện trở kháng.";
  }
  if (lower.includes("body composition") && lower.includes("estimated")) {
    return "Thành phần cơ thể là số liệu ước tính từ dòng điện sinh học BIA.";
  }
  if (lower.includes("blurry") || lower.includes("blur") || lower.includes("unclear")) {
    return "Ảnh chụp phiếu đo có vùng hơi mờ, PT vui lòng đối chiếu kỹ lại số đo trên phiếu gốc.";
  }
  if (lower.includes("confidence") && (lower.includes("low") || lower.includes("thấp"))) {
    return "Độ nét của ảnh phiếu đo chưa cao, vui lòng rà soát lại các số liệu.";
  }
  return w;
}

function findMatchingCustomerId(
  detectedName: string,
  candidates: Array<{ _id?: unknown; fullName?: unknown }>,
): string {
  const clean = normalizeName(detectedName)
    .replace(/^(?:id|name|ten|ho ten|kh|mr|ms|mrs|anh|chi)\s*[:.-]?\s*/i, "")
    .trim();
  if (!clean) return "";
  const targetTokens = clean.split(" ").filter((t) => t.length > 1);
  let bestId = "";
  let bestScore = 0;

  for (const c of candidates) {
    const cand = normalizeName(String(c.fullName || ""));
    if (!cand) continue;
    let score = 0;
    if (cand === clean) score = 100;
    else if (cand.includes(clean) || clean.includes(cand)) score = 90;
    else if (targetTokens.length) {
      const candTokens = new Set(cand.split(" ").filter((t) => t.length > 1));
      const matched = targetTokens.filter((t) => candTokens.has(t)).length;
      score = Math.round((matched / Math.max(targetTokens.length, candTokens.size)) * 100);
    }
    if (score >= 70 && score > bestScore) {
      bestScore = score;
      bestId = String(c._id);
    }
  }
  return bestId;
}

export async function scanInBody(
  actor: GymActor,
  files: Express.Multer.File[],
  body: Record<string, unknown>,
) {
  if (!files || !files.length) {
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Vui lòng chọn ảnh hoặc file PDF phiếu InBody.",
    );
  }
  if (files.length > 5) {
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Chỉ hỗ trợ tối đa 5 ảnh/file PDF cho mỗi lần quét phiếu InBody.",
    );
  }

  const fileParts: OpenRouterContentPart[] = [];
  for (const file of files) {
    const isPdf =
      file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname);
    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(
      file.mimetype,
    );
    if (!isPdf && !isImage) {
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Chỉ hỗ trợ định dạng JPG, PNG, WebP hoặc PDF.",
      );
    }
    if (isPdf) {
      if (file.buffer.subarray(0, 5).toString() !== "%PDF-") {
        throw new ValidationError("VALIDATION_FAILED", "File PDF không hợp lệ.");
      }
      fileParts.push({
        type: "file",
        file: {
          filename: file.originalname || "inbody.pdf",
          file_data: `data:application/pdf;base64,${file.buffer.toString("base64")}`,
        },
      });
    } else {
      const normalized = await sharp(file.buffer, { limitInputPixels: 25_000_000 })
        .rotate()
        .resize({
          width: 1800,
          height: 1800,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 88 })
        .toBuffer();
      fileParts.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${normalized.toString("base64")}` },
      });
    }
  }

  const prompt = `Bạn là chuyên gia thị giác máy tính OCR phân tích phiếu đo thể trạng InBody (InBody 270, 370S, 570, 770, Tanita, Accuniq).
Hãy đọc kỹ hình ảnh hoặc tài liệu phiếu đo (nếu có nhiều ảnh hoặc nhiều trang, hãy tổng hợp thông tin từ tất cả các ảnh/trang của cùng phiếu đo) và trích xuất dữ liệu thành đúng 1 JSON object thuần túy theo cấu trúc sau:

1. customerName: Họ tên hoặc ID học viên/khách hàng in trên phiếu (thường ở góc trên cùng, gần nhãn 'ID', 'Name', 'User', 'Họ tên'). Loại bỏ các tiền tố như "Name:", "ID:", "Sex:". Nếu không thấy trả về null.
2. measurementDate: Ngày đo trên phiếu (gần nhãn 'Test Date', 'Date / Time', 'Ngày đo'), chuẩn hóa YYYY-MM-DD. Nếu không thấy trả về null.
3. weight: Cân nặng thực tế đo được (kg) - số dương. CHÚ Ý: Luôn lấy giá trị thực tế đo được (cột Current / Measured Value), tuyệt đối KHÔNG lấy cột khoảng chuẩn (Normal Range).
4. height: Chiều cao học viên in trên phiếu (cm). Nếu không thấy trả về null.
5. muscleMass: Khối lượng cơ xương (SMM - Skeletal Muscle Mass) tính bằng kg. Luôn ưu tiên lấy SMM.
6. bodyFatMass: Khối lượng mỡ cơ thể (BFM) tính bằng kg.
7. bodyFatPercentage: Phần trăm mỡ cơ thể (PBF / %Fat), 0-100.
8. bmi: Chỉ số khối cơ thể (BMI).
9. bmr: Tỷ lệ trao đổi chất cơ bản (BMR, kcal).
10. visceralFatLevel: Cấp độ mỡ nội tạng (VFL, 1-20).
11. inbodyScore: Điểm InBody (0-100).
12. bodyWater: Tổng lượng nước cơ thể (TBW, L hoặc kg).
13. boneMineral: Khoáng chất trong xương (BMC, kg).
14. waistHipRatio: Tỷ lệ eo/hông (WHR).
15. segmentalMuscle: { rightArm, leftArm, trunk, rightLeg, leftLeg } (kg, không lấy %).
16. segmentalFat: { rightArm, leftArm, trunk, rightLeg, leftLeg } (kg).
17. confidence: Số thực 0.0-1.0 đánh giá độ nét và độ tin cậy của ảnh.
18. warnings: Mảng chuỗi tiếng Việt lưu ý nếu có chỉ số mờ, bị che khuất hoặc là giá trị ước tính.

LƯU Ý: Chỉ số nào không có trên phiếu gán null. Chỉ trả về JSON thuần túy, không kèm giải thích.`;

  const { text } = await withAiUsage(
    { companyCode: actor.companyCode, userId: actor.userId },
    () =>
      openrouterChat({
        model: gymAiModel(),
        temperature: 0,
        jsonMode: true,
        maxTokens: 1600,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, ...fileParts],
          },
        ],
      }),
  );

  const parsed = parseJsonObject(text);
  const detectedCustomerName =
    typeof (parsed.customerName ?? parsed.detectedCustomerName) === "string" &&
    String(parsed.customerName ?? parsed.detectedCustomerName).trim()
      ? String(parsed.customerName ?? parsed.detectedCustomerName).trim()
      : null;

  let matchedCustomerId =
    typeof body.customerId === "string" && /^[a-f0-9]{24}$/i.test(body.customerId)
      ? body.customerId
      : "";

  if (!matchedCustomerId && detectedCustomerName) {
    const candidates = await records("customers")
      .find(customerFilter(actor))
      .project({ _id: 1, fullName: 1 })
      .limit(200)
      .toArray();
    matchedCustomerId = findMatchingCustomerId(detectedCustomerName, candidates);
  }

  const rawDate =
    (typeof body.measurementDate === "string" && body.measurementDate.trim()) ||
    (typeof parsed.measurementDate === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(parsed.measurementDate.trim())
      ? parsed.measurementDate.trim().slice(0, 10)
      : "") ||
    todayIso();

  let rawConf =
    typeof parsed.confidence === "number"
      ? parsed.confidence
      : parseFloat(String(parsed.confidence || "0.85"));
  if (!Number.isFinite(rawConf)) rawConf = 0.85;
  if (rawConf > 1 && rawConf <= 100) rawConf = rawConf / 100;
  const confidence = Math.round(Math.min(Math.max(rawConf, 0), 1) * 100) / 100;

  const sanitizeSegment = (seg: unknown) => {
    if (!seg || typeof seg !== "object") return null;
    const s = seg as Record<string, unknown>;
    return {
      rightArm: toOptionalNumber(s.rightArm, 100) ?? null,
      leftArm: toOptionalNumber(s.leftArm, 100) ?? null,
      trunk: toOptionalNumber(s.trunk, 200) ?? null,
      rightLeg: toOptionalNumber(s.rightLeg, 100) ?? null,
      leftLeg: toOptionalNumber(s.leftLeg, 100) ?? null,
    };
  };

  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings
        .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
        .map(normalizeInBodyWarning)
    : [];

  const extracted: Record<string, unknown> = {
    source: "OCR",
    measurementDate: rawDate,
    weight: toOptionalNumber(parsed.weight, 600) ?? "",
    height: toOptionalNumber(parsed.height, 300) ?? "",
    bmi: toOptionalNumber(parsed.bmi, 100) ?? "",
    bodyFatPercentage: toOptionalNumber(parsed.bodyFatPercentage, 100) ?? "",
    bodyFatMass: toOptionalNumber(parsed.bodyFatMass, 300) ?? "",
    muscleMass: toOptionalNumber(parsed.muscleMass, 300) ?? "",
    bmr: toOptionalNumber(parsed.bmr, 10000) ?? "",
    visceralFatLevel: toOptionalNumber(parsed.visceralFatLevel, 50) ?? "",
    inbodyScore: toOptionalNumber(parsed.inbodyScore, 100) ?? "",
    bodyWater: toOptionalNumber(parsed.bodyWater, 200) ?? "",
    boneMineral: toOptionalNumber(parsed.boneMineral, 50) ?? "",
    waistHipRatio: toOptionalNumber(parsed.waistHipRatio, 5) ?? "",
    segmentalMuscle: sanitizeSegment(parsed.segmentalMuscle),
    segmentalFat: sanitizeSegment(parsed.segmentalFat),
    waist: toOptionalNumber(parsed.waist, 300) ?? "",
    hip: toOptionalNumber(parsed.hip, 300) ?? "",
    chest: toOptionalNumber(parsed.chest, 300) ?? "",
    notes: typeof parsed.notes === "string" ? parsed.notes.trim() : "",
  };

  return {
    extracted,
    matchedCustomerId,
    detectedCustomerName,
    confidence,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. NUTRITION AI (Analyze + Multi-Day Plan Generator)
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeNutrition(
  actor: GymActor,
  input: Record<string, unknown>,
) {
  const customerCtx = await loadCustomerAiContext(actor, input.customerId, {
    required: false,
  });
  const weight =
    toOptionalNumber(input.weight, 600) ??
    toOptionalNumber(customerCtx?.latestMeasurement?.weight, 600) ??
    toOptionalNumber(customerCtx?.customer.initialWeight, 600) ??
    65;
  const height =
    toOptionalNumber(input.height, 300) ??
    toOptionalNumber(customerCtx?.latestMeasurement?.height, 300) ??
    toOptionalNumber(customerCtx?.customer.height, 300) ??
    170;
  const age = toOptionalNumber(input.age, 120) ?? customerCtx?.age ?? 26;
  const gender =
    input.gender === "FEMALE" || customerCtx?.customer.gender === "FEMALE"
      ? "Nữ"
      : "Nam";
  const activity = Number(input.activity) || 1.55;
  const bodyFat =
    String(input.bodyFat || "").trim() ||
    (customerCtx?.latestMeasurement?.bodyFatPercentage != null
      ? `${customerCtx.latestMeasurement.bodyFatPercentage}%`
      : "");
  const bodyType = String(input.bodyType || "").trim();
  const scheduleNote = String(input.scheduleNote || "").trim();
  const eatingHabits = String(input.eatingHabits || "").trim();
  const medicalNotes = String(input.medicalNotes || customerCtx?.customer.medicalNotes || "").trim();
  const customAiRequest = String(input.customAiRequest || "").trim();
  const specificGoal =
    String(input.specificGoal || "").trim() ||
    String(customerCtx?.customer.initialGoal || "").trim();

  const prompt = `Bạn là chuyên gia dinh dưỡng thể hình cho phòng gym Việt Nam.
${customerCtx ? `${customerCtx.promptBlock}\n\n` : `${AI_FACTUAL_RULE}\n\n`}Phân tích chuyển hóa, NEAT và đề xuất chỉ tiêu dinh dưỡng từ thông số sau, trả về JSON hợp lệ bằng tiếng Việt:
- Giới tính: ${gender}, Tuổi: ${age}, Cân nặng: ${weight} kg, Chiều cao: ${height} cm${bodyFat ? `, % Mỡ: ${bodyFat}` : ""}
- Hệ số vận động tham khảo: ${activity}
- Dạng thể chất: ${bodyType || "(để trống)"}
- Lịch trình sinh hoạt & giờ tập: ${scheduleNote || "(để trống)"}
- Thói quen ăn uống / dị ứng: ${eatingHabits || "(để trống)"}
- Lưu ý sức khỏe / bệnh lý: ${medicalNotes || "(để trống)"}
- Mục tiêu cụ thể: ${specificGoal || "(để trống)"}
- Yêu cầu bổ sung: ${customAiRequest || "(để trống)"}

JSON schema:
{
  "bmr": number,
  "tdee": number,
  "targetCalories": number,
  "deficitOrSurplus": number,
  "goalLabel": string,
  "macros": { "protein": number, "carbs": number, "fat": number },
  "waterLiters": number,
  "summary": string,
  "timingStrategy": [{ "time": "HH:MM", "meal": string, "focus": string, "calorieTarget": number }],
  "mealTiming": string[],
  "dietaryAdvice": {
    "recommendedFoods": string[],
    "avoidFoods": string[],
    "supplements": string[],
    "keyNotes": string
  },
  "recommendations": string[],
  "warnings": string[]
}`;

  const { text } = await withAiUsage(
    { companyCode: actor.companyCode, userId: actor.userId },
    () =>
      openrouterChat({
        model: gymAiModel(),
        temperature: 0.35,
        jsonMode: true,
        maxTokens: 1800,
        messages: [{ role: "user", content: prompt }],
      }),
  );

  const parsed = parseJsonObject(text);
  const fallbackBmr = Math.round(
    10 * weight + 6.25 * height - 5 * age + (gender === "Nam" ? 5 : -161),
  );
  const bmr = Math.round(toOptionalNumber(parsed.bmr, 8000) ?? fallbackBmr);
  const tdee = Math.round(
    toOptionalNumber(parsed.tdee, 10000) ?? Math.round(bmr * activity),
  );
  const targetCalories = Math.max(
    1200,
    Math.round(
      toOptionalNumber(parsed.targetCalories, 10000) ?? tdee,
    ),
  );
  const rawMacros = (parsed.macros || {}) as Record<string, unknown>;
  const protein = Math.round(
    toOptionalNumber(rawMacros.protein, 600) ?? Math.round(weight * 1.9),
  );
  const fat = Math.round(
    toOptionalNumber(rawMacros.fat, 300) ??
      Math.round((targetCalories * 0.25) / 9),
  );
  const carbs = Math.round(
    toOptionalNumber(rawMacros.carbs, 1000) ??
      Math.max(0, Math.round((targetCalories - protein * 4 - fat * 9) / 4)),
  );

  const strList = (v: unknown) =>
    Array.isArray(v)
      ? v
          .map((item) => String(item || "").trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];

  const timingStrategy = Array.isArray(parsed.timingStrategy)
    ? parsed.timingStrategy.slice(0, 6).map((t: any) => ({
        time: String(t?.time || "").trim(),
        meal: String(t?.meal || "").trim(),
        focus: String(t?.focus || "").trim(),
        calorieTarget: Math.round(toOptionalNumber(t?.calorieTarget, 3000) ?? 0),
      }))
    : [];

  const rawAdvice = (parsed.dietaryAdvice || {}) as Record<string, unknown>;
  const proteinCal = protein * 4;
  const carbsCal = carbs * 4;
  const fatCal = fat * 9;
  const totalMacroCal = Math.max(1, proteinCal + carbsCal + fatCal);

  return {
    bmr,
    tdee,
    targetCalories,
    deficitOrSurplus: targetCalories - tdee,
    goalLabel:
      typeof parsed.goalLabel === "string" && parsed.goalLabel.trim()
        ? parsed.goalLabel.trim()
        : specificGoal || "Theo mục tiêu học viên",
    macros: { protein, carbs, fat },
    macroCalories: { protein: proteinCal, carbs: carbsCal, fat: fatCal },
    macroPercentages: {
      protein: Math.round((proteinCal / totalMacroCal) * 100),
      carbs: Math.round((carbsCal / totalMacroCal) * 100),
      fat: Math.round((fatCal / totalMacroCal) * 100),
    },
    waterLiters:
      toOptionalNumber(parsed.waterLiters, 10) ??
      Math.max(1.5, Math.round(weight * 0.04 * 10) / 10),
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
    timingStrategy,
    mealTiming:
      strList(parsed.mealTiming).length > 0
        ? strList(parsed.mealTiming)
        : timingStrategy.map((t) => `${t.time} ${t.meal}: ${t.focus} (~${t.calorieTarget} kcal)`),
    dietaryAdvice: {
      recommendedFoods: strList(rawAdvice.recommendedFoods),
      avoidFoods: strList(rawAdvice.avoidFoods),
      supplements: strList(rawAdvice.supplements),
      keyNotes: typeof rawAdvice.keyNotes === "string" ? rawAdvice.keyNotes.trim() : "",
    },
    recommendations: strList(parsed.recommendations),
    warnings: strList(parsed.warnings),
  };
}

export async function generateNutritionPlan(
  actor: GymActor,
  input: Record<string, unknown>,
) {
  const customerCtx = await loadCustomerAiContext(actor, input.customerId, {
    required: true,
  });
  const targetCalories = Math.max(1200, Number(input.targetCalories) || 2000);
  const mealsPerDay = Math.min(6, Math.max(2, Number(input.mealsPerDay) || 4));
  const durationDays = Math.min(14, Math.max(1, Number(input.durationDays) || 7));
  const dietStyle = String(input.dietStyle || "Món Việt dễ nấu").trim();
  const budgetLevel = String(input.budgetLevel || "STANDARD").trim();
  const workoutSchedule = String(input.workoutSchedule || "").trim();
  const allergies = Array.isArray(input.allergies)
    ? input.allergies.map((a) => String(a || "").trim()).filter(Boolean)
    : [];
  const goal =
    String(input.goal || "").trim() ||
    String(customerCtx?.customer.initialGoal || "").trim() ||
    "Giảm mỡ, giữ cơ";
  const eatingHabits = String(input.eatingHabits || dietStyle).trim();
  const notes = String(input.notes || "").trim();
  const macrosIn = (input.macros || {}) as Record<string, unknown>;
  const proteinTarget = Number(macrosIn.protein) || Math.round((targetCalories * 0.3) / 4);
  const carbsTarget = Number(macrosIn.carbs) || Math.round((targetCalories * 0.45) / 4);
  const fatTarget = Number(macrosIn.fat) || Math.round((targetCalories * 0.25) / 9);
  const startDate =
    typeof input.startDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(input.startDate)
      ? input.startDate.slice(0, 10)
      : todayIso();

  const foods = await records("food-images")
    .find(tenantFilter(actor))
    .project({ _id: 1, name: 1, imageUrl: 1, calories: 1, protein: 1, carbs: 1, fat: 1 })
    .limit(80)
    .toArray();
  const foodListText = foods.length
    ? `\nƯu tiên dùng các món có sẵn trong kho nếu phù hợp: ${foods
        .map((f) => String(f.name || ""))
        .filter(Boolean)
        .slice(0, 40)
        .join(", ")}.`
    : "";

  const dailyPlans: Array<{
    dayNumber: number;
    date: string;
    meals: Array<{
      name: string;
      time: string;
      foods: string;
      items: Array<{
        name: string;
        amount: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        prepTip: string;
      }>;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      imageId: string;
      imageUrl: string;
    }>;
  }> = [];

  let generatedTitle = "";
  let generatedNotes = "";

  // Batch up to 7 days per call (matching 3S-Gym contentDraftService.ts)
  for (let offset = 0; offset < durationDays; offset += 7) {
    const batchCount = Math.min(7, durationDays - offset);
    const prompt = `Bạn là chuyên gia dinh dưỡng thể hình Việt Nam. Hãy thiết kế thực đơn cá nhân hóa ${batchCount} ngày (từ Ngày ${offset + 1} đến Ngày ${offset + batchCount}), mỗi ngày gồm ${mealsPerDay} bữa ăn bằng tiếng Việt cho học viên sau:
${customerCtx!.promptBlock}

CẤU HÌNH THỰC ĐƠN:
- Mục tiêu: ${goal}
- Tổng calo mục tiêu/ngày: ${targetCalories} kcal (Đạm ~${proteinTarget}g, Carb ~${carbsTarget}g, Fat ~${fatTarget}g)
- Phong cách ăn: ${dietStyle} | Ngân sách: ${budgetLevel}
- Thói quen ăn uống: ${eatingHabits}
${allergies.length ? `- TUYỆT ĐỐI TRÁNH DỊ ỨNG / KIÊNG: ${allergies.join(", ")}` : ""}
${workoutSchedule ? `- Lịch tập: ${workoutSchedule}` : ""}
${notes ? `- Ghi chú thêm: ${notes}` : ""}${foodListText}

QUY TẮC BỮA ĂN VIỆT:
- Bữa chính gồm 3 món (Đạm + Tinh bột + Canh/Rau), bữa sáng 2-3 món, bữa phụ 1-2 món.
- Luân phiên đổi nguồn đạm giữa các ngày (ức gà, cá, trứng, thịt nạc, đậu hũ, tôm nếu không dị ứng).
- Trả về JSON hợp lệ:
{
  "title": string,
  "notes": string,
  "days": [
    {
      "dayNumber": number,
      "meals": [
        {
          "name": string,
          "time": "HH:MM",
          "items": [
            { "name": string, "amount": string, "calories": number, "protein": number, "carbs": number, "fat": number, "prepTip": string }
          ]
        }
      ]
    }
  ]
}`;

    const { text } = await withAiUsage(
      { companyCode: actor.companyCode, userId: actor.userId },
      () =>
        openrouterChat({
          model: gymAiModel(),
          temperature: 0.5,
          jsonMode: true,
          maxTokens: 6000,
          messages: [{ role: "user", content: prompt }],
        }),
    );

    const parsed = parseJsonObject(text);
    if (!generatedTitle && typeof parsed.title === "string" && parsed.title.trim()) {
      generatedTitle = parsed.title.trim();
    }
    if (!generatedNotes && typeof parsed.notes === "string" && parsed.notes.trim()) {
      generatedNotes = parsed.notes.trim();
    }

    const rawDays = Array.isArray(parsed.days)
      ? parsed.days
      : Array.isArray(parsed.menu)
        ? [{ dayNumber: offset + 1, meals: parsed.menu }]
        : [];

    for (let dIdx = 0; dIdx < batchCount; dIdx++) {
      const rawDay = rawDays[dIdx] || rawDays[0] || { meals: [] };
      const rawMeals = Array.isArray(rawDay.meals) ? rawDay.meals : [];
      const meals = rawMeals.slice(0, 8).map((meal: any, idx: number) => {
        const items = Array.isArray(meal?.items)
          ? meal.items.slice(0, 8).map((it: any) => ({
              name: String(it?.name || "").trim(),
              amount: String(it?.amount || "").trim(),
              calories: Math.round(toOptionalNumber(it?.calories, 3000) ?? 0),
              protein: Math.round(toOptionalNumber(it?.protein, 200) ?? 0),
              carbs: Math.round(toOptionalNumber(it?.carbs, 300) ?? 0),
              fat: Math.round(toOptionalNumber(it?.fat, 150) ?? 0),
              prepTip: String(it?.prepTip || "").trim(),
            }))
          : [];
        const foodsText =
          items.length > 0
            ? items
                .map((it: any) => `${it.name}${it.amount ? ` (${it.amount})` : ""}`)
                .join(", ")
            : String(meal?.foods || "").trim();
        const calories =
          items.length > 0
            ? items.reduce((s: number, it: any) => s + it.calories, 0)
            : Math.round(toOptionalNumber(meal?.calories, 5000) ?? 0);
        const protein =
          items.length > 0
            ? items.reduce((s: number, it: any) => s + it.protein, 0)
            : Math.round(toOptionalNumber(meal?.protein, 300) ?? 0);
        const carbs =
          items.length > 0
            ? items.reduce((s: number, it: any) => s + it.carbs, 0)
            : Math.round(toOptionalNumber(meal?.carbs, 500) ?? 0);
        const fat =
          items.length > 0
            ? items.reduce((s: number, it: any) => s + it.fat, 0)
            : Math.round(toOptionalNumber(meal?.fat, 200) ?? 0);

        const normFoods = normalizeName(foodsText);
        const matched = foods.find((f) => {
          const fn = normalizeName(String(f.name || ""));
          return fn && normFoods.includes(fn);
        });
        return {
          name: String(meal?.name || `Bữa ${idx + 1}`).trim(),
          time: typeof meal?.time === "string" ? meal.time.trim().slice(0, 5) : "",
          foods: foodsText,
          items,
          calories,
          protein,
          carbs,
          fat,
          imageId: matched ? String(matched._id) : "",
          imageUrl: matched?.imageUrl ? String(matched.imageUrl) : "",
        };
      });

      dailyPlans.push({
        dayNumber: offset + dIdx + 1,
        date: addDaysIso(startDate, offset + dIdx),
        meals,
      });
    }
  }

  const day1Menu = (dailyPlans[0]?.meals || []).map(({ items: _items, ...m }) => m);

  return {
    customerId: customerCtx!.customerId,
    title:
      generatedTitle ||
      `Thực đơn ${durationDays} ngày (${targetCalories} kcal) — ${customerCtx!.customer.fullName}`,
    bmr: toOptionalNumber(input.bmr, 8000) ?? "",
    tdee: toOptionalNumber(input.tdee, 10000) ?? "",
    targetCalories,
    macros: {
      protein: proteinTarget,
      carbs: carbsTarget,
      fat: fatTarget,
    },
    startDate,
    endDate: addDaysIso(startDate, Math.max(durationDays - 1, 0)),
    notes: generatedNotes || notes,
    menu: day1Menu,
    dailyPlans,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. EXERCISE AI (Ported from 3S-Gym aiExerciseService.ts: 1-10 batch + dedupe)
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_LEVELS = new Set(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const ALLOWED_TRACKING = new Set([
  "STRENGTH",
  "BODYWEIGHT",
  "CARDIO",
  "INTERVAL",
  "MOBILITY",
]);

export async function generateExercise(
  actor: GymActor,
  input: Record<string, unknown>,
) {
  const promptText = String(input.prompt || "").trim();
  const muscleGroupHint = String(input.muscleGroup || "").trim();
  const equipmentHint = String(input.equipment || "").trim();
  if (!promptText && !muscleGroupHint) {
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Vui lòng nhập mô tả bài tập hoặc nhóm cơ.",
    );
  }

  const fullPromptText = [
    promptText || `Tạo bài tập cho nhóm cơ ${muscleGroupHint}`,
    muscleGroupHint && `Nhóm cơ ưu tiên: ${muscleGroupHint}`,
    equipmentHint && `Dụng cụ: ${equipmentHint}`,
  ]
    .filter(Boolean)
    .join(". ");

  const quantity = parseExerciseQuantity(fullPromptText, input.quantity);

  const prompt = `Bạn là chuyên gia xây dựng thư viện bài tập cho phòng gym. Yêu cầu người dùng: ${JSON.stringify(fullPromptText)}.
Trả về duy nhất JSON object dạng { "exercises": [...] } gồm CHÍNH XÁC ${quantity} bài khác nhau.
Mỗi bài phải có đủ 11 trường: name, muscleGroups, muscleGroup, level, defaultTrackingType, equipment, description, technique, commonMistakes, contraindications, variants.
QUY TẮC BẮT BUỘC VỀ TÊN BÀI TẬP:
- Trường name (tên bài tập) PHẢI 100% LÀ TIẾNG ANH CHUẨN theo thuật ngữ thể hình quốc tế (ví dụ: "Barbell Bench Press", "Romanian Deadlift", "Bulgarian Split Squat", "Lat Pulldown", "Plank"). TUYỆT ĐỐI KHÔNG dịch tên bài tập sang tiếng Việt.
- TUYỆT ĐỐI KHÔNG chứa bất kỳ dấu ngoặc đơn () hay [] hay {} nào trong trường name.
- muscleGroups là mảng tên nhóm cơ tiếng Việt chuẩn (Ngực, Lưng, Vai, Tay trước, Tay sau, Chân, Mông, Bụng / Core, Toàn thân, Tim mạch / Cardio...). muscleGroup là chuỗi nối bởi dấu phẩy.
- equipment, commonMistakes, contraindications, variants là mảng chuỗi (mảng rỗng nếu không có).
- description và technique viết bằng tiếng Việt rõ ràng, súc tích.
- level chỉ nhận BEGINNER, INTERMEDIATE, ADVANCED.
- defaultTrackingType chỉ nhận STRENGTH, BODYWEIGHT, CARDIO, INTERVAL, MOBILITY.`;

  const { text } = await withAiUsage(
    { companyCode: actor.companyCode, userId: actor.userId },
    () =>
      openrouterChat({
        model: gymAiModel(),
        temperature: 0.4,
        jsonMode: true,
        maxTokens: Math.min(4500, 900 + quantity * 450),
        messages: [{ role: "user", content: prompt }],
      }),
  );

  const parsed = parseJsonObject(text);
  const rawList = Array.isArray(parsed.exercises)
    ? parsed.exercises
    : [parsed];

  const existingDocs = await records("exercises")
    .find(tenantFilter(actor))
    .project({ name: 1 })
    .limit(500)
    .toArray();
  const existingSet = new Set(
    existingDocs.map((e) => normalizeName(String(e.name || ""))),
  );

  const cleanArr = (v: unknown) =>
    Array.isArray(v)
      ? v.map((x) => String(x || "").trim()).filter(Boolean)
      : typeof v === "string" && v.trim()
        ? v.split(",").map((x) => x.trim()).filter(Boolean)
        : [];

  const seen = new Set<string>();
  const drafts = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const name = cleanExerciseName((item as any).name);
    if (!name) continue;
    const norm = normalizeName(name);
    if (seen.has(norm)) continue;
    seen.add(norm);

    let muscleGroups = cleanArr((item as any).muscleGroups);
    let muscleGroup = String((item as any).muscleGroup || "").trim();
    if (muscleGroups.length && !muscleGroup) muscleGroup = muscleGroups.join(", ");
    else if (!muscleGroups.length && muscleGroup) {
      muscleGroups = muscleGroup.split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (!muscleGroups.length) {
      muscleGroups = [muscleGroupHint || "Toàn thân"];
      muscleGroup = muscleGroups[0];
    }

    const level = ALLOWED_LEVELS.has(String((item as any).level || ""))
      ? String((item as any).level)
      : "BEGINNER";
    const defaultTrackingType = ALLOWED_TRACKING.has(
      String((item as any).defaultTrackingType || (item as any).trackingType || ""),
    )
      ? String((item as any).defaultTrackingType || (item as any).trackingType)
      : "STRENGTH";
    const equipment = cleanArr((item as any).equipment);
    const description = String((item as any).description || "").trim();
    const technique = String((item as any).technique || (item as any).instructions || "").trim();
    const commonMistakes = cleanArr((item as any).commonMistakes);
    const contraindications = cleanArr((item as any).contraindications);
    const variants = cleanArr((item as any).variants);

    drafts.push({
      name,
      muscleGroup,
      muscleGroups,
      level,
      defaultTrackingType,
      trackingType: defaultTrackingType,
      equipment,
      description,
      technique,
      instructions: [description, technique].filter(Boolean).join("\n\n"),
      commonMistakes,
      contraindications,
      variants,
      isDuplicate: existingSet.has(norm),
    });
    if (drafts.length >= quantity) break;
  }

  if (!drafts.length) {
    throw new Error("AI không trả về bài tập hợp lệ. Vui lòng thử lại.");
  }

  return {
    drafts,
    discardedCount: Math.max(0, rawList.length - drafts.length),
    // Keep top-level fields of first draft for backward compatibility
    ...drafts[0],
    equipment: drafts[0].equipment.join(", "),
  };
}

export async function saveExerciseBulk(
  actor: GymActor,
  input: Record<string, unknown>,
) {
  const items = Array.isArray(input.exercises) ? input.exercises : [];
  if (!items.length || items.length > 20) {
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Vui lòng chọn từ 1 đến 20 bài tập để lưu.",
    );
  }
  const existingDocs = await records("exercises")
    .find(tenantFilter(actor))
    .project({ name: 1 })
    .limit(1000)
    .toArray();
  const existingSet = new Set(
    existingDocs.map((e) => normalizeName(String(e.name || ""))),
  );

  const now = new Date().toISOString();
  const inserted: any[] = [];
  const skipped: string[] = [];

  for (const raw of items) {
    const name = cleanExerciseName((raw as any)?.name);
    if (!name) continue;
    const norm = normalizeName(name);
    if (existingSet.has(norm)) {
      skipped.push(name);
      continue;
    }
    existingSet.add(norm);
    const equipmentList = Array.isArray((raw as any)?.equipment)
      ? (raw as any).equipment.map((x: unknown) => String(x || "").trim()).filter(Boolean)
      : typeof (raw as any)?.equipment === "string"
        ? (raw as any).equipment.split(",").map((x: string) => x.trim()).filter(Boolean)
        : [];
    const muscleGroups = Array.isArray((raw as any)?.muscleGroups)
      ? (raw as any).muscleGroups.map((x: unknown) => String(x || "").trim()).filter(Boolean)
      : String((raw as any)?.muscleGroup || "Toàn thân")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
    const trackingType = ALLOWED_TRACKING.has(
      String((raw as any)?.defaultTrackingType || (raw as any)?.trackingType || ""),
    )
      ? String((raw as any)?.defaultTrackingType || (raw as any)?.trackingType)
      : "STRENGTH";
    const description = String((raw as any)?.description || "").trim();
    const technique = String((raw as any)?.technique || (raw as any)?.instructions || "").trim();

    const doc = {
      _id: new ObjectId().toHexString(),
      ...tenantFilter(actor),
      name,
      muscleGroup: muscleGroups.join(", ") || "Toàn thân",
      muscleGroups,
      level: ALLOWED_LEVELS.has(String((raw as any)?.level || ""))
        ? String((raw as any).level)
        : "BEGINNER",
      equipment: equipmentList.join(", "),
      description,
      instructions: technique || description,
      commonMistakes: Array.isArray((raw as any)?.commonMistakes) ? (raw as any).commonMistakes : [],
      contraindications: Array.isArray((raw as any)?.contraindications) ? (raw as any).contraindications : [],
      variants: Array.isArray((raw as any)?.variants) ? (raw as any).variants : [],
      videoUrl: "",
      trackingType,
      revision: 1,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    };
    await records("exercises").insertOne(doc);
    inserted.push(doc);
  }

  return {
    insertedCount: inserted.length,
    skippedCount: skipped.length,
    skippedNames: skipped,
    data: inserted,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. WORKOUT AI (Ported from 3S-Gym aiWorkoutService.ts: Proposal -> Generate)
// ─────────────────────────────────────────────────────────────────────────────

interface AvailabilitySlot {
  dayNumber: number; // 1 (Mon) .. 7 (Sun)
  startMinute: number;
  endMinute: number;
}

const DAY_LABELS: Record<number, string> = {
  1: "Thứ 2",
  2: "Thứ 3",
  3: "Thứ 4",
  4: "Thứ 5",
  5: "Thứ 6",
  6: "Thứ 7",
  7: "Chủ nhật",
};

function parseMinuteString(hhmm: string): number {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatMinute(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function normalizeAvailabilitySlots(input: unknown): AvailabilitySlot[] {
  if (!Array.isArray(input)) return [];
  const slots: AvailabilitySlot[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const obj = item as any;
    if (typeof obj.dayNumber === "number" && typeof obj.startMinute === "number" && typeof obj.endMinute === "number") {
      if (obj.dayNumber >= 1 && obj.dayNumber <= 7 && obj.endMinute > obj.startMinute) {
        slots.push({
          dayNumber: Math.round(obj.dayNumber),
          startMinute: Math.max(0, Math.round(obj.startMinute)),
          endMinute: Math.min(1440, Math.round(obj.endMinute)),
        });
      }
    } else if (obj.dayOfWeek && Array.isArray(obj.slots)) {
      const dayNum = Object.entries(DAY_LABELS).find(([, label]) => label === obj.dayOfWeek)?.[0];
      if (!dayNum) continue;
      for (const s of obj.slots) {
        const start = parseMinuteString(s?.start);
        const end = parseMinuteString(s?.end);
        if (start >= 0 && end > start) {
          slots.push({ dayNumber: Number(dayNum), startMinute: start, endMinute: end });
        }
      }
    }
  }
  return slots;
}

function computeAvailabilityDefaults(slots: AvailabilitySlot[]) {
  if (!slots.length) return { sessionsPerWeek: 3, minutesPerSession: 60 };
  const maxByDay = new Map<number, number>();
  for (const s of slots) {
    const dur = s.endMinute - s.startMinute;
    maxByDay.set(s.dayNumber, Math.max(maxByDay.get(s.dayNumber) || 0, dur));
  }
  const sessionsPerWeek = Math.min(7, Math.max(1, maxByDay.size));
  const minLongest = Math.min(...Array.from(maxByDay.values()));
  const minutesPerSession = Math.min(240, Math.max(15, Math.round(minLongest / 15) * 15));
  return { sessionsPerWeek, minutesPerSession };
}

function normalizeWorkoutLevel(level: unknown): "BEGINNER" | "INTERMEDIATE" | "ADVANCED" {
  const s = String(level || "").toUpperCase();
  if (s.includes("BEGIN") || s.includes("CƠ BẢN") || s.includes("MỚI")) return "BEGINNER";
  if (s.includes("ADVANC") || s.includes("NÂNG CAO")) return "ADVANCED";
  return "INTERMEDIATE";
}

export async function createWorkoutProposal(
  actor: GymActor,
  input: Record<string, unknown>,
) {
  const customerCtx = await loadCustomerAiContext(actor, input.customerId, {
    required: true,
  });
  const slots = normalizeAvailabilitySlots(input.availabilitySlots ?? input.availability);
  if (!slots.length) {
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Vui lòng thêm ít nhất 1 khung giờ rảnh trong tuần của học viên.",
    );
  }
  const defaults = computeAvailabilityDefaults(slots);
  const library = await records("exercises")
    .find(tenantFilter(actor))
    .project({ _id: 1, name: 1, muscleGroup: 1, trackingType: 1 })
    .limit(150)
    .toArray();

  const slotsDesc = slots
    .map(
      (s) =>
        `${DAY_LABELS[s.dayNumber] || `Ngày ${s.dayNumber}`}: ${formatMinute(s.startMinute)}–${formatMinute(s.endMinute)} (${s.endMinute - s.startMinute} phút)`,
    )
    .join("; ");

  const prompt = `Trả về duy nhất JSON đề xuất giáo án 1-12 tuần cho học viên sau:
${customerCtx!.promptBlock}
- Khung giờ rảnh lặp lại mỗi tuần: ${slotsDesc}
- Cấu hình tự tính bắt buộc từ lịch rảnh: ${defaults.sessionsPerWeek} buổi/tuần, ${defaults.minutesPerSession} phút/buổi.
- Thư viện bài tập hiện có (${library.length} bài): ${library.slice(0, 60).map((e) => e.name).join(", ") || "chưa có"}.

Trả về JSON hợp lệ:
{
  "durationWeeks": number (1-12),
  "sessionsPerWeek": ${defaults.sessionsPerWeek},
  "minutesPerSession": ${defaults.minutesPerSession},
  "level": "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
  "trainingMethod": string,
  "trainingSplit": string,
  "priorityMuscleGroups": string[],
  "restrictions": string[]
}`;

  const { text } = await withAiUsage(
    { companyCode: actor.companyCode, userId: actor.userId },
    () =>
      openrouterChat({
        model: gymAiModel(),
        temperature: 0.35,
        jsonMode: true,
        maxTokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
  );

  const parsed = parseJsonObject(text);
  return {
    durationWeeks: Math.min(12, Math.max(1, Math.round(Number(parsed.durationWeeks) || 8))),
    sessionsPerWeek: defaults.sessionsPerWeek,
    minutesPerSession: defaults.minutesPerSession,
    level: normalizeWorkoutLevel(parsed.level),
    trainingMethod:
      typeof parsed.trainingMethod === "string" && parsed.trainingMethod.trim()
        ? parsed.trainingMethod.trim()
        : "Huấn luyện kháng lực kết hợp tim mạch",
    trainingSplit:
      typeof parsed.trainingSplit === "string" && parsed.trainingSplit.trim()
        ? parsed.trainingSplit.trim()
        : "Toàn thân (Full Body)",
    priorityMuscleGroups: Array.isArray(parsed.priorityMuscleGroups)
      ? parsed.priorityMuscleGroups.map(String).filter(Boolean)
      : [],
    restrictions: Array.isArray(parsed.restrictions)
      ? parsed.restrictions.map(String).filter(Boolean)
      : [],
  };
}

export async function generateWorkoutTemplate(
  actor: GymActor,
  input: Record<string, unknown>,
) {
  const customerCtx = await loadCustomerAiContext(actor, input.customerId, {
    required: false,
  });
  const slots = normalizeAvailabilitySlots(input.availabilitySlots ?? input.availability);
  const proposal = (input.proposal && typeof input.proposal === "object"
    ? input.proposal
    : null) as Record<string, any> | null;

  const goal =
    String(input.goal || "").trim() ||
    String(customerCtx?.customer.initialGoal || "").trim() ||
    "Tăng cơ, giảm mỡ";
  const levelCode = normalizeWorkoutLevel(proposal?.level ?? input.level);
  const levelLabel =
    levelCode === "BEGINNER"
      ? "Cơ bản"
      : levelCode === "ADVANCED"
        ? "Nâng cao"
        : "Trung bình";
  const durationWeeks = Math.min(
    24,
    Math.max(1, Number(proposal?.durationWeeks ?? input.durationWeeks) || 4),
  );
  const defaults = computeAvailabilityDefaults(slots);
  const daysPerWeek = Math.min(
    7,
    Math.max(
      1,
      Number(proposal?.sessionsPerWeek ?? (slots.length ? defaults.sessionsPerWeek : input.daysPerWeek)) || 4,
    ),
  );
  const minutesPerSession = Math.min(
    240,
    Math.max(15, Number(proposal?.minutesPerSession ?? defaults.minutesPerSession) || 60),
  );
  const notes = String(input.additionalRequest ?? input.prompt ?? "").trim();

  const existingExercises = await records("exercises")
    .find(tenantFilter(actor))
    .project({ _id: 1, name: 1, muscleGroup: 1, trackingType: 1 })
    .limit(150)
    .toArray();
  const exerciseByNorm = new Map<string, { id: string; name: string }>();
  for (const ex of existingExercises) {
    exerciseByNorm.set(normalizeName(String(ex.name || "")), {
      id: String(ex._id),
      name: String(ex.name || ""),
    });
  }

  const catalogHint = existingExercises.length
    ? `\nƯu tiên tối đa các bài tập đã có trong thư viện: ${existingExercises
        .map((e) => String(e.name || ""))
        .slice(0, 60)
        .join(", ")}.`
    : "";

  const availabilityHint = slots.length
    ? `\nTHỜI GIAN RẢNH HÀNG TUẦN CỦA HỌC VIÊN (bắt buộc xếp đúng ${daysPerWeek} buổi và ghi rõ thứ/khung giờ vào tiêu đề buổi):\n${slots
        .map((s) => `- ${DAY_LABELS[s.dayNumber]}: ${formatMinute(s.startMinute)}–${formatMinute(s.endMinute)} (${s.endMinute - s.startMinute}p)`)
        .join("\n")}`
    : "";

  const proposalHint = proposal
    ? `\nĐỀ XUẤT ĐÃ DUYỆT: Phương pháp "${proposal.trainingMethod || ""}", Phân chia "${proposal.trainingSplit || ""}", Thời lượng ${minutesPerSession} phút/buổi, Nhóm cơ ưu tiên: ${(proposal.priorityMuscleGroups || []).join(", ") || "toàn thân"}, Hạn chế: ${(proposal.restrictions || []).join(", ") || "không có"}.`
    : "";

  const prompt = `Bạn là HLV gym chuyên nghiệp. Hãy tạo 1 giáo án ${daysPerWeek} buổi/tuần trong ${durationWeeks} tuần (${minutesPerSession} phút/buổi) bằng tiếng Việt.
${customerCtx ? `${customerCtx.promptBlock}\n\n` : `${AI_FACTUAL_RULE}\n\n`}THÔNG SỐ GIÁO ÁN:
- Mục tiêu: ${goal}
- Cấp độ: ${levelLabel}
${notes ? `- Yêu cầu thêm của PT: ${notes}` : ""}${proposalHint}${availabilityHint}${catalogHint}

QUY TẮC TÊN BÀI TẬP (BẮT BUỘC):
- Tên mỗi bài tập (name) PHẢI 100% TIẾNG ANH CHUẨN quốc tế (VD: "Barbell Bench Press", "Goblet Squat", "Plank"). TUYỆT ĐỐI KHÔNG chứa dấu ngoặc () [] {} hay chú thích tiếng Việt trong name.
- Ghi rõ kỹ thuật / RPE / lưu ý bằng tiếng Việt trong trường notes.

Trả về JSON hợp lệ:
{
  "title": string,
  "goal": string,
  "level": string,
  "description": string,
  "schedule": [
    {
      "day": number,
      "title": string,
      "exercises": [
        {
          "name": string,
          "muscleGroup": string,
          "trackingType": "STRENGTH" | "BODYWEIGHT" | "CARDIO" | "INTERVAL" | "MOBILITY",
          "sets": number,
          "reps": string,
          "restSeconds": number,
          "notes": string
        }
      ]
    }
  ]
}
Mỗi buổi 4–6 bài tập phù hợp thời lượng ${minutesPerSession} phút, mục tiêu và lưu ý sức khỏe.`;

  const { text } = await withAiUsage(
    { companyCode: actor.companyCode, userId: actor.userId },
    () =>
      openrouterChat({
        model: gymAiModel(),
        temperature: 0.45,
        jsonMode: true,
        maxTokens: 3200,
        messages: [{ role: "user", content: prompt }],
      }),
  );

  const parsed = parseJsonObject(text);
  const rawSchedule = Array.isArray(parsed.schedule) ? parsed.schedule : [];

  // IMPORTANT (ported from 3S-Gym): DO NOT insert new exercises into DB during AI generation!
  // Return generatedExercises as draft so PT reviews before saving (avoids orphan exercises).
  const generatedExercises: Array<{
    draftId: string;
    name: string;
    muscleGroup: string;
    trackingType: string;
    instructions: string;
  }> = [];
  const generatedMap = new Map<string, string>();
  const schedule = [];

  for (let i = 0; i < Math.min(rawSchedule.length, daysPerWeek); i++) {
    const dayObj = rawSchedule[i] || {};
    const rawExList = Array.isArray(dayObj.exercises) ? dayObj.exercises : [];
    const exercises = [];
    for (const ex of rawExList.slice(0, 12)) {
      const cleanedName = cleanExerciseName(ex?.name);
      if (!cleanedName) continue;
      const norm = normalizeName(cleanedName);
      const existing = exerciseByNorm.get(norm);
      let exId = existing?.id || generatedMap.get(norm);
      if (!exId) {
        exId = new ObjectId().toHexString();
        generatedMap.set(norm, exId);
        generatedExercises.push({
          draftId: exId,
          name: cleanedName,
          muscleGroup: String(ex?.muscleGroup || "Toàn thân").trim(),
          trackingType: ALLOWED_TRACKING.has(String(ex?.trackingType || ""))
            ? String(ex.trackingType)
            : "STRENGTH",
          instructions: String(ex?.notes || "").trim(),
        });
      }
      exercises.push({
        exerciseId: exId,
        name: existing?.name || cleanedName,
        sets: Math.max(1, Math.min(20, Math.round(Number(ex?.sets) || 3))),
        reps: String(ex?.reps || "10-12").trim(),
        weight: 0,
        duration: 0,
        distance: 0,
        restSeconds: Math.max(
          0,
          Math.min(600, Math.round(Number(ex?.restSeconds) || 60)),
        ),
        notes: String(ex?.notes || "").trim(),
      });
    }
    schedule.push({
      day: i + 1,
      title: String(dayObj.title || `Buổi ${i + 1}`).trim(),
      exercises,
    });
  }

  return {
    customerId: customerCtx?.customerId || "",
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : customerCtx
          ? `Giáo án ${proposal?.trainingSplit || goal} — ${customerCtx.customer.fullName}`
          : `Giáo án ${goal} (${durationWeeks} tuần)`,
    goal:
      typeof parsed.goal === "string" && parsed.goal.trim()
        ? parsed.goal.trim()
        : goal,
    level: levelLabel,
    durationWeeks,
    description:
      typeof parsed.description === "string" ? parsed.description.trim() : "",
    status: "DRAFT",
    schedule,
    generatedExercises,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ROADMAP AI (Ported from 3S-Gym roadmapGeneration.ts: Strategy + Weeks + Guard)
// ─────────────────────────────────────────────────────────────────────────────

const EXERCISE_LEAK_RE =
  /\b(?:squats?|deadlifts?|lunges?|planks?|push[ -]?ups?|pull[ -]?ups?|bench press|goblet squat|glute bridge|hip hinge|step[ -]?up|bird dog|dead bug|row|rows)\b|chống đẩy|hít đất|gập bụng|nâng chân/iu;

const SETS_REPS_LEAK_RE = /\d+(?:\s*[-–]\s*\d+)?\s*(?:hiệp|reps?|sets?)\b/iu;

function findRoadmapNarrativeIssues(
  draft: Record<string, any>,
  age: number | null,
  goalType: string,
): string[] {
  const issues: string[] = [];
  const visit = (val: unknown, inPhases: boolean) => {
    if (typeof val === "string") {
      if (inPhases && EXERCISE_LEAK_RE.test(val)) {
        issues.push(`Chứa tên bài tập cụ thể trong giai đoạn/tuần: "${val.slice(0, 80)}"`);
      }
      if (inPhases && SETS_REPS_LEAK_RE.test(val)) {
        issues.push(`Chứa số hiệp/reps trong roadmap: "${val.slice(0, 80)}"`);
      }
      if (goalType === "WEIGHT_LOSS" && /\d+(?:[.,]\d+)?\s*kg\s*(?:mỡ|fat)/iu.test(val)) {
        issues.push("Đổi nhầm mục tiêu giảm kg cân nặng thành giảm kg mỡ");
      }
      if (age !== null && [...val.matchAll(/(\d{1,3})\s*tuổi/gu)].some((m) => Number(m[1]) !== age)) {
        issues.push(`Ghi sai tuổi (tuổi đúng là ${age})`);
      }
    } else if (Array.isArray(val)) {
      val.forEach((v) => visit(v, inPhases));
    } else if (val && typeof val === "object") {
      for (const [k, v] of Object.entries(val)) {
        visit(v, inPhases || k === "phases");
      }
    }
  };
  visit(draft, false);
  return issues;
}

export async function generateRoadmap(
  actor: GymActor,
  input: Record<string, unknown>,
) {
  const customerCtx = await loadCustomerAiContext(actor, input.customerId, {
    required: true,
  });
  const goalType = String(input.goalType || "FAT_LOSS").trim();
  const targetValue = toOptionalNumber(input.targetValue, 200);
  const targetUnit = String(input.targetUnit || "kg").trim();
  const durationWeeks = Math.min(52, Math.max(2, Number(input.durationWeeks) || 12));
  const sessionsPerWeek = Math.min(7, Math.max(2, Number(input.sessionsPerWeek) || 3));
  const sessionDurationMinutes = Math.min(
    180,
    Math.max(20, Number(input.sessionDurationMinutes) || 60),
  );
  const startDate =
    typeof input.startDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(input.startDate)
      ? input.startDate.slice(0, 10)
      : todayIso();
  const totalDays = durationWeeks * 7;
  const endDate = addDaysIso(startDate, totalDays);

  const ptRequest =
    String(input.prompt || "").trim() ||
    String(customerCtx!.customer.initialGoal || "").trim() ||
    `Mục tiêu ${goalType}${targetValue ? ` ${targetValue} ${targetUnit}` : ""} trong ${durationWeeks} tuần`;

  const constraints = {
    goalType,
    ...(targetValue ? { targetValue, targetUnit } : {}),
    durationWeeks,
    sessionsPerWeek,
    sessionDurationMinutes,
  };

  const basePrompt = `Bạn là Chuyên gia Khoa học Thể thao & Huấn luyện viên thể hình. Hãy phân tích hồ sơ học viên và tạo Lộ trình huấn luyện (Roadmap) cá nhân hóa dạng JSON kéo dài ${durationWeeks} tuần (${startDate} → ${endDate}):
- Ngày đánh giá: ${todayIso()}. Tuổi do hệ thống tính: ${customerCtx!.age ?? "chưa xác định"}. Không tự tính lại tuổi.
${customerCtx!.promptBlock}

RÀNG BUỘC CÓ CẤU TRÚC TỪ PT (ưu tiên hơn mục tiêu cũ):
${JSON.stringify(constraints)}
- Yêu cầu bổ sung từ PT: ${ptRequest}

QUY TẮC BẮT BUỘC (3S-Gym Standard):
1. Trả về DUY NHẤT 1 JSON object hợp lệ.
2. Nếu goalType là FITNESS hoặc STRENGTH: targetCalories phải bằng tdee, không tự tạo thâm hụt. WEIGHT_LOSS/FAT_LOSS: thâm hụt; WEIGHT_GAIN/MUSCLE_GAIN: thặng dư. Không tự đổi giảm kg cân nặng thành giảm kg mỡ.
3. Không tự điền số đo thiếu vào baseline. Mọi giả định ước lượng dinh dưỡng phải liệt kê trong strategy.assumptions (string[]).
4. Chia thành 3-4 phases nối tiếp, tổng durationWeeks của các phase = ${durationWeeks}. Mỗi phase gồm mảng weeks đầy đủ từ tuần 1 đến tuần ${durationWeeks} với focus (trọng tâm tuần cụ thể) và sessionTargets = ${sessionsPerWeek}.
5. CẤM rò rỉ giáo án vào Roadmap: phases.goals và weeks.focus CHỈ mô tả chiến lược, thích nghi, kỹ thuật, phục hồi. KHÔNG ghi tên bài tập cụ thể (squat, deadlift, lunge, plank, push-up, row...) và KHÔNG ghi số hiệp/reps.
6. sessionBudget (warmupMinutes + strengthMinutes + cardioMinutes + cooldownMinutes) <= ${sessionDurationMinutes} phút.

JSON schema:
{
  "title": string,
  "notes": string,
  "strategy": {
    "targetSummary": string,
    "estimatedWeeks": ${durationWeeks},
    "sessionsPerWeek": ${sessionsPerWeek},
    "sessionBudget": { "warmupMinutes": number, "strengthMinutes": number, "cardioMinutes": number, "cooldownMinutes": number },
    "trainingMethod": string,
    "trainingSplit": string,
    "cardioProtocol": string,
    "assumptions": string[],
    "nutrition": {
      "bmr": number,
      "tdee": number,
      "targetCalories": number,
      "calorieDeficitOrSurplus": number,
      "proteinGrams": number,
      "carbsGrams": number,
      "fatGrams": number,
      "waterLiters": number,
      "advice": string
    },
    "checkpoints": [{ "week": number, "title": string, "description": string }]
  },
  "phases": [
    {
      "title": string,
      "weeksCount": number,
      "goals": string,
      "notes": string,
      "weeks": [{ "week": number, "focus": string, "sessionTargets": number }]
    }
  ]
}`;

  let parsed: Record<string, any> = {};
  let nextPrompt = basePrompt;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text } = await withAiUsage(
      { companyCode: actor.companyCode, userId: actor.userId },
      () =>
        openrouterChat({
          model: gymAiModel(),
          temperature: attempt === 0 ? 0.35 : 0.2,
          jsonMode: true,
          maxTokens: 3200,
          messages: [{ role: "user", content: nextPrompt }],
        }),
    );
    parsed = parseJsonObject(text);
    const issues = findRoadmapNarrativeIssues(parsed, customerCtx!.age, goalType);
    if (!issues.length || attempt === 1) break;
    nextPrompt = `${basePrompt}\n\nLẦN SỬA LỖI DUY NHẤT — Kết quả trước vi phạm các lỗi sau, bắt buộc sửa sạch:\n- ${issues.join("\n- ")}`;
  }

  // Balance roadmap nutrition arithmetic in code (ported from balanceRoadmapNutrition)
  const strategy =
    parsed.strategy && typeof parsed.strategy === "object"
      ? { ...parsed.strategy }
      : {};
  if (strategy.nutrition && typeof strategy.nutrition === "object") {
    const n = { ...strategy.nutrition };
    const tdee = Math.round(toOptionalNumber(n.tdee, 10000) ?? 2000);
    const targetCal =
      goalType === "FITNESS" || goalType === "STRENGTH"
        ? tdee
        : Math.max(1200, Math.round(toOptionalNumber(n.targetCalories, 10000) ?? tdee));
    const proteinGrams = Math.round(toOptionalNumber(n.proteinGrams, 400) ?? 120);
    const fatGrams = Math.round(toOptionalNumber(n.fatGrams, 200) ?? 55);
    const rem = Math.max(0, targetCal - proteinGrams * 4 - fatGrams * 9);
    const carbsGrams = Math.round(rem / 4);
    const diff = targetCal - tdee;
    strategy.nutrition = {
      ...n,
      bmr: Math.round(toOptionalNumber(n.bmr, 8000) ?? Math.round(tdee / 1.45)),
      tdee,
      targetCalories: targetCal,
      calorieDeficitOrSurplus: diff,
      proteinGrams,
      carbsGrams,
      fatGrams,
      waterLiters: toOptionalNumber(n.waterLiters, 10) ?? 2.5,
      advice: `Chỉ tiêu ước lượng: ${targetCal} kcal/ngày; Đạm ${proteinGrams}g, Carb ${carbsGrams}g, Fat ${fatGrams}g. ${
        diff === 0
          ? "Duy trì năng lượng bằng TDEE ước lượng."
          : `Chênh lệch so với TDEE: ${diff > 0 ? `+${diff}` : diff} kcal/ngày.`
      }`,
    };
  }

  const rawPhases =
    Array.isArray(parsed.phases) && parsed.phases.length
      ? parsed.phases.slice(0, Math.min(6, durationWeeks))
      : [
          {
            title: "Giai đoạn 1: Xây nền tảng",
            weeksCount: durationWeeks,
            goals: ptRequest,
            notes: "",
            weeks: [],
          },
        ];

  const totalWeights = rawPhases.reduce(
    (sum: number, p: any) =>
      sum + Math.max(1, Number(p?.weeksCount ?? p?.durationWeeks ?? p?.weeks?.length) || 1),
    0,
  );
  let weekCounter = 1;
  let phasesWeeksUsed = 0;
  const phases = rawPhases.map((p: any, idx: number) => {
    const rawW = Math.max(1, Number(p?.weeksCount ?? p?.durationWeeks ?? p?.weeks?.length) || 1);
    const remaining = durationWeeks - phasesWeeksUsed;
    const durationWeeksForPhase = idx === rawPhases.length - 1
      ? remaining
      : Math.min(Math.max(1, Math.round((rawW / totalWeights) * durationWeeks)), remaining - (rawPhases.length - idx - 1));
    phasesWeeksUsed += durationWeeksForPhase;
    const goals = Array.isArray(p?.goals)
      ? p.goals.map(String).filter(Boolean)
      : String(p?.goals || "").split(/[;\n]/).map((item: string) => item.trim()).filter(Boolean);
    const weeks = Array.isArray(p?.weeks)
      ? p.weeks.map((w: any) => ({
          week: weekCounter++,
          focus: String(w?.focus || "").trim(),
          sessionTargets: Math.max(1, Math.min(7, Number(w?.sessionTargets) || sessionsPerWeek)),
          sessions: [],
        }))
      : [];
    while (weeks.length < durationWeeksForPhase) weeks.push({ week: weekCounter++, focus: String(p?.title || p?.name || "Trọng tâm tập luyện").trim(), sessionTargets: sessionsPerWeek, sessions: [] });
    weeks.splice(durationWeeksForPhase);
    return {
      order: idx + 1,
      name: String(p?.title || p?.name || `Giai đoạn ${idx + 1}`).trim(),
      durationWeeks: durationWeeksForPhase,
      goals,
      weeks,
    };
  });

  const strategySummary = [
    strategy.trainingMethod && `Phương pháp: ${strategy.trainingMethod}`,
    strategy.trainingSplit && `Lịch tập: ${strategy.trainingSplit}`,
    strategy.cardioProtocol && `Cardio: ${strategy.cardioProtocol}`,
    strategy.nutrition?.advice,
    Array.isArray(strategy.assumptions) && strategy.assumptions.length
      ? `Giả định dữ liệu thiếu: ${strategy.assumptions.join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    customerId: customerCtx!.customerId,
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : `Lộ trình ${durationWeeks} tuần — ${customerCtx!.customer.fullName}`,
    startDate,
    endDate,
    status: "DRAFT",
    baseline: customerCtx!.baseline,
    strategy,
    notes: [typeof parsed.notes === "string" ? parsed.notes.trim() : "", strategySummary]
      .filter(Boolean)
      .join("\n\n"),
    phases,
  };
}
