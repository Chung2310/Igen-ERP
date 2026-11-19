import type Joi from 'joi';

export interface ValidationIssue { field: string; message: string }

const MESSAGE_MARKER = '__JOI_DEFAULT__:';

export const FIELD_LABELS: Record<string, string> = {
  // Common & Generic
  id: 'mã định danh',
  _id: 'mã định danh',
  page: 'số trang',
  limit: 'số lượng mỗi trang',
  search: 'từ khóa tìm kiếm',
  keyword: 'từ khóa tìm kiếm',
  status: 'trạng thái',
  createdAt: 'ngày tạo',
  updatedAt: 'ngày cập nhật',
  from: 'từ ngày',
  to: 'đến ngày',
  version: 'phiên bản',
  date: 'ngày',
  asOf: 'thời điểm tính toán',
  key: 'khóa cấu hình',
  active: 'trạng thái hoạt động',
  sortOrder: 'thứ tự hiển thị',

  // Auth & Account
  username: 'tên đăng nhập',
  password: 'mật khẩu',
  fullName: 'họ và tên',
  email: 'email',
  phone: 'số điện thoại',
  role: 'vai trò',
  roles: 'danh sách vai trò',
  avatarUrl: 'ảnh đại diện',
  dateOfBirth: 'ngày sinh',
  gender: 'giới tính',
  sex: 'giới tính',
  age: 'tuổi',
  yearsOfExperience: 'số năm kinh nghiệm',
  certificates: 'chứng chỉ',
  bio: 'tiểu sử / giới thiệu',
  address: 'địa chỉ',
  specialization: 'chuyên môn',
  userId: 'mã người dùng',
  pilotUserIds: 'danh sách người dùng thử nghiệm',

  // Customers & Transfers & Care
  customerId: 'mã khách hàng',
  toPtId: 'mã PT tiếp nhận',
  fromPtId: 'mã PT chuyển giao',
  ownerPtId: 'mã PT phụ trách',
  ptId: 'mã PT',
  assignedPtId: 'mã PT được phân công',
  reason: 'lý do',
  source: 'nguồn',
  notes: 'ghi chú',
  consultationNotes: 'ghi chú tư vấn',
  dueAt: 'hạn hoàn thành',
  kind: 'loại',
  result: 'kết quả',
  medicalNotes: 'tiền sử / lưu ý y tế',
  initialGoal: 'mục tiêu ban đầu',
  internalNotes: 'ghi chú nội bộ',
  customerStatus: 'trạng thái khách hàng',
  height: 'chiều cao',
  initialWeight: 'cân nặng ban đầu',

  // Exercises & Tracking
  exerciseId: 'mã bài tập',
  name: 'tên',
  muscleGroup: 'nhóm cơ',
  level: 'cấp độ',
  scope: 'phạm vi',
  equipment: 'thiết bị',
  description: 'mô tả',
  videoUrl: 'đường dẫn video',
  videos: 'danh sách video',
  technique: 'kỹ thuật',
  commonMistakes: 'lỗi thường gặp',
  contraindications: 'chống chỉ định',
  variants: 'biến thể',
  defaultTrackingType: 'cách ghi nhận mặc định',
  trackingType: 'cách ghi nhận',
  prescription: 'thông số chỉ định',
  sets: 'số hiệp (sets)',
  reps: 'số lần (reps)',
  weight: 'mức tạ',
  rpe: 'chỉ số RPE',
  rir: 'chỉ số RIR',
  tempo: 'nhịp độ (tempo)',
  restSeconds: 'thời gian nghỉ (giây)',
  addedWeight: 'tạ thêm',
  targetWeight: 'mức tạ mục tiêu',
  targetRpe: 'RPE mục tiêu',
  targetRir: 'RIR mục tiêu',
  targetDiscomfort: 'mức độ khó chịu mục tiêu',
  rounds: 'số vòng (rounds)',
  workSeconds: 'thời gian tập (giây)',
  distanceMetersPerRound: 'khoảng cách mỗi vòng (m)',
  repsPerRound: 'số lần mỗi vòng',
  distanceKm: 'quãng đường (km)',
  targetPaceSecondsPerKm: 'pace mục tiêu',
  targetHeartRate: 'nhịp tim mục tiêu',
  inclinePercent: 'độ dốc (%)',
  side: 'bên thực hiện',
  discomfort: 'mức độ căng/khó chịu',

  // Workout Plans & Sessions
  title: 'tiêu đề',
  goal: 'mục tiêu',
  durationDays: 'số ngày của giáo án',
  muscleGroups: 'danh sách nhóm cơ',
  defaultSets: 'số hiệp mặc định',
  defaultReps: 'số lần mặc định',
  defaultWeight: 'mức tạ mặc định',
  defaultTempo: 'nhịp độ mặc định',
  technicalNotes: 'ghi chú kỹ thuật',
  scheduledExercises: 'lịch bài tập',
  unscheduledExercises: 'bài tập chưa xếp lịch',
  generatedExercises: 'bài tập AI gợi ý',
  sessions: 'danh sách buổi tập',
  sessionIndex: 'thứ tự buổi tập',
  dayNumber: 'ngày tập',
  weekNumber: 'tuần tập',
  startMinute: 'thời gian bắt đầu',
  durationMinutes: 'thời lượng (phút)',
  templateId: 'mã giáo án mẫu',
  planId: 'mã giáo án',
  workoutPlanId: 'mã giáo án',
  workoutPlanVersion: 'phiên bản giáo án',
  performedAt: 'thời gian thực hiện',
  attendance: 'trạng thái điểm danh',
  exerciseResults: 'kết quả bài tập',
  exerciseLogs: 'nhật ký bài tập',
  absenceReason: 'lý do vắng mặt',
  feeling: 'cảm nhận sau buổi tập',
  idempotencyKey: 'mã giao dịch (idempotencyKey)',
  totalSessions: 'tổng số buổi tập',
  usedSessions: 'số buổi đã tập',
  startDate: 'ngày bắt đầu',
  endDate: 'ngày kết thúc',

  // Goals & Roadmaps
  type: 'loại',
  deadline: 'hạn hoàn thành',
  targetValue: 'giá trị mục tiêu',
  targetUnit: 'đơn vị mục tiêu',
  sessionsPerWeek: 'số buổi mỗi tuần',
  cardioNotes: 'ghi chú cardio',
  evaluationNotes: 'ghi chú đánh giá',
  baseline: 'chỉ số ban đầu',
  strategy: 'chiến lược',
  phases: 'các giai đoạn lộ trình',
  order: 'thứ tự',
  durationWeeks: 'thời gian (tuần)',
  goals: 'mục tiêu',
  weeks: 'danh sách tuần',
  sessionTargets: 'mục tiêu buổi tập',

  // InBody & Health Metrics
  measurementDate: 'ngày đo',
  measuredAt: 'ngày đo',
  weightKg: 'cân nặng (kg)',
  heightCm: 'chiều cao (cm)',
  bmi: 'chỉ số BMI',
  bodyFatPercentage: 'tỷ lệ mỡ (%)',
  bodyFatMass: 'khối lượng mỡ (kg)',
  muscleMass: 'khối lượng cơ (kg)',
  bodyFat: 'tỷ lệ mỡ (%)',
  bmr: 'chỉ số BMR',
  tdee: 'chỉ số TDEE',
  visceralFatLevel: 'mỡ nội tạng',
  inbodyScore: 'điểm InBody',
  bodyWater: 'lượng nước cơ thể',
  boneMineral: 'khoáng chất xương',
  waistHipRatio: 'tỷ lệ eo/hông',
  segmentalMuscle: 'phân bố cơ theo phân đoạn',
  segmentalFat: 'phân bố mỡ theo phân đoạn',
  rightArm: 'tay phải',
  leftArm: 'tay trái',
  trunk: 'thân người',
  rightLeg: 'chân phải',
  leftLeg: 'chân trái',
  strengths: 'điểm mạnh',
  priorities: 'ưu tiên cải thiện',
  recommendation: 'đề xuất',
  targetCalories: 'calo mục tiêu',
  macros: 'đa lượng dinh dưỡng (macros)',
  protein: 'chất đạm (protein)',
  carbs: 'tinh bột (carbs)',
  fat: 'chất béo (fat)',
  menu: 'thực đơn',
  chest: 'vòng ngực',
  waist: 'vòng eo',
  hips: 'vòng mông',
  arm: 'vòng tay',
  thigh: 'vòng đùi',
  calf: 'vòng bắp chân',
  measurements: 'số đo các vòng',

  // Nutrition & Calculations
  mealCount: 'số bữa ăn',
  activityLevel: 'mức độ vận động',
  timeframe: 'khoảng thời gian',
  activityFactor: 'hệ số vận động',
  fatLossFactor: 'hệ số giảm mỡ',
  muscleGainFactor: 'hệ số tăng cơ',
  proteinPerKg: 'lượng protein/kg thể trọng',
  fatPerKg: 'lượng chất béo/kg thể trọng',
  loggedAt: 'thời điểm ghi nhận',
  calories: 'lượng calo',
  met: 'chỉ số MET',
  bodyType: 'tạng người',
  dailySchedule: 'lịch sinh hoạt hàng ngày',
  dietaryPreferences: 'thói quen ăn uống',
  fitnessGoal: 'mục tiêu thể hình',
  request: 'yêu cầu',

  // Operations & Reports
  fromDate: 'từ ngày',
  toDate: 'đến ngày',
  periodStart: 'ngày bắt đầu kỳ báo cáo',
  periodEnd: 'ngày kết thúc kỳ báo cáo',
  metrics: 'chỉ số đo lường',
  sourceVersions: 'phiên bản dữ liệu',
  startsAt: 'thời gian bắt đầu',
  endsAt: 'thời gian kết thúc',

  // Credits & Billing
  gateway: 'cổng thanh toán',
  paymentGateway: 'cổng thanh toán',
  packageId: 'gói credit',
  customAmountVnd: 'số tiền nạp',
  amountVnd: 'số tiền VNĐ',
  grantCredits: 'số credit',
  bonusCredits: 'credit thưởng',
  credits: 'số credit',
  currency: 'loại tiền tệ',
  markupBasisPoints: 'tỷ lệ điều chỉnh (markup)',
  fallbackCredits: 'credit dự phòng',
  minBillableCredits: 'credit tối thiểu',
  maxReservationCredits: 'credit tạm giữ tối đa',
  enabled: 'trạng thái kích hoạt',
  usdToVnd: 'tỷ giá USD/VNĐ',
  vndPerCredit: 'giá trị VNĐ trên 1 credit',
  taskType: 'loại tác vụ AI',
  orderId: 'mã đơn hàng',

  // Knowledge & AI & Upload
  q: 'từ khóa tìm kiếm',
  topic: 'chủ đề',
  effectiveAt: 'ngày hiệu lực',
  requestType: 'loại yêu cầu',
  scenario: 'kịch bản',
  reviewStatus: 'trạng thái kiểm duyệt',
  category: 'danh mục',
  tags: 'thẻ tags',
  content: 'nội dung',
  summary: 'tóm tắt',
  question: 'câu hỏi',
  answer: 'câu trả lời',
  conversationId: 'mã cuộc hội thoại',
  message: 'tin nhắn',
  prompt: 'lời nhắc (prompt)',
  items: 'danh sách món ăn',
  seed: 'seed ngẫu nhiên',
  imageBase64: 'chuỗi ảnh Base64',
  mimetype: 'định dạng tệp tin',
};

export function formatFieldLabel(path: string): string {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];
  const parts = path.split('.');
  const lastPart = parts[parts.length - 1];
  const translatedLast = FIELD_LABELS[lastPart] || lastPart;
  if (parts.length > 1) {
    const parent = parts[parts.length - 2];
    if (!isNaN(Number(parent))) {
      const grandParent = parts[parts.length - 3] || '';
      const index = Number(parent) + 1;
      const grandParentLabel = FIELD_LABELS[grandParent] || grandParent;
      return `${translatedLast} (${grandParentLabel ? grandParentLabel + ' ' : ''}thứ ${index})`;
    }
    const parentLabel = FIELD_LABELS[parent] || parent;
    return `${translatedLast} của ${parentLabel}`;
  }
  return translatedLast;
}

type Translator = (field: string, context: Record<string, unknown>) => string;

const translators: Record<string, Translator> = {
  'any.required': (field) => `Vui lòng nhập ${field}.`,
  'any.only': (field) => `${field} phải là một trong các giá trị được cho phép.`,
  'any.invalid': (field) => `Giá trị của ${field} không hợp lệ.`,
  'any.unknown': (field) => `Trường "${field}" không được phép.`,
  'alternatives.match': (field) => `Giá trị của ${field} không hợp lệ.`,
  'alternatives.types': (field) => `Kiểu dữ liệu của ${field} không hợp lệ.`,
  'array.base': (field) => `${field} phải là một danh sách.`,
  'array.length': (field, context) => `${field} phải có đúng ${context.limit} phần tử.`,
  'array.max': (field, context) => `${field} không được có quá ${context.limit} phần tử.`,
  'array.min': (field, context) => `${field} phải có ít nhất ${context.limit} phần tử.`,
  'array.unique': (field) => `${field} không được chứa giá trị trùng lặp.`,
  'boolean.base': (field) => `${field} phải là giá trị đúng hoặc sai (true/false).`,
  'date.base': (field) => `${field} phải là ngày hợp lệ.`,
  'date.format': (field) => `${field} không đúng định dạng ngày.`,
  'date.greater': (field) => `${field} phải sau mốc thời gian được yêu cầu.`,
  'date.less': (field) => `${field} phải trước mốc thời gian được yêu cầu.`,
  'date.max': (field) => `${field} không được sau mốc thời gian tối đa.`,
  'date.min': (field) => `${field} không được trước mốc thời gian tối thiểu.`,
  'number.base': (field) => `${field} phải là một số.`,
  'number.greater': (field, context) => `${field} phải lớn hơn ${context.limit}.`,
  'number.integer': (field) => `${field} phải là số nguyên.`,
  'number.less': (field, context) => `${field} phải nhỏ hơn ${context.limit}.`,
  'number.max': (field, context) => `${field} phải nhỏ hơn hoặc bằng ${context.limit}.`,
  'number.min': (field, context) => `${field} phải lớn hơn hoặc bằng ${context.limit}.`,
  'number.positive': (field) => `${field} phải là số dương.`,
  'number.multiple': (field, context) => `${field} phải là bội số của ${context.multiple}.`,
  'object.base': (field) => `${field} phải là một đối tượng.`,
  'object.length': (field, context) => `${field} phải có đúng ${context.limit} trường.`,
  'object.max': (field, context) => `${field} không được có quá ${context.limit} trường.`,
  'object.min': () => 'Vui lòng cung cấp ít nhất một trường cần cập nhật.',
  'object.unknown': (field) => `Trường "${field}" không được phép.`,
  'object.xor': (_field, context) => {
    const peers = Array.isArray(context.peers) ? context.peers.map((p) => formatFieldLabel(String(p))).join(', ') : '';
    return peers ? `Chỉ được chọn 1 trong các trường: ${peers}.` : 'Không thể chọn đồng thời các trường xung đột.';
  },
  'object.oxor': (_field, context) => {
    const peers = Array.isArray(context.peers) ? context.peers.map((p) => formatFieldLabel(String(p))).join(', ') : '';
    return peers ? `Không được chọn đồng thời các trường: ${peers}.` : 'Không thể chọn đồng thời các trường xung đột.';
  },
  'object.missing': (_field, context) => {
    const peers = Array.isArray(context.peers) ? context.peers.map((p) => formatFieldLabel(String(p))).join(', ') : '';
    return peers ? `Vui lòng cung cấp ít nhất 1 trong các trường: ${peers}.` : 'Vui lòng cung cấp ít nhất một trường bắt buộc.';
  },
  'string.alphanum': (field) => `${field} chỉ được chứa chữ và số.`,
  'string.base': (field) => `${field} phải là chuỗi ký tự.`,
  'string.email': () => 'Email không đúng định dạng.',
  'string.empty': (field) => `Vui lòng nhập ${field}.`,
  'string.length': (field, context) => `${field} phải có đúng ${context.limit} ký tự.`,
  'string.max': (field, context) => `${field} không được vượt quá ${context.limit} ký tự.`,
  'string.min': (field, context) => `${field} phải có ít nhất ${context.limit} ký tự.`,
  'string.pattern.base': (field) => `${field} không đúng định dạng yêu cầu.`,
  'string.uri': (field) => `${field} phải là đường dẫn URL hợp lệ.`,
  'string.objectId': (field) => `${field} không phải mã ObjectId hợp lệ.`,
};

export const joiMessages = Object.fromEntries(
  Object.keys(translators).map((type) => [type, `${MESSAGE_MARKER}${type}`]),
);

export function validationIssue(detail: Joi.ValidationErrorItem, fallbackField: string): ValidationIssue {
  const rawField = detail.path.length > 0 ? detail.path.join('.') : fallbackField;
  const label = formatFieldLabel(rawField);

  if (detail.context?.custom && typeof detail.context.custom === 'string') {
    return { field: rawField, message: detail.context.custom };
  }

  const translator = translators[detail.type];
  if (translator) {
    return { field: rawField, message: translator(label, detail.context || {}) };
  }

  if (detail.message && !detail.message.startsWith(MESSAGE_MARKER)) {
    const cleanedMessage = detail.message.replace(new RegExp(`\\b${rawField}\\b`, 'g'), label);
    return { field: rawField, message: cleanedMessage };
  }

  return { field: rawField, message: `Giá trị của ${label} không hợp lệ.` };
}

