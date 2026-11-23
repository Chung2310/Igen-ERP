import Joi from "joi";
import { ValidationError } from "../../errors/app-error";
import type { GymEntity } from "../../../shared/gym/types";

const text = () => Joi.string().trim().max(2000).allow("").default("");
const title = () => Joi.string().trim().max(200).required();
const num = () => Joi.number().min(0).max(100000);
const id = () => Joi.string().hex().length(24);
const date = () => Joi.string().isoDate();
const macros = Joi.object({
  protein: num().required(),
  carbs: num().required(),
  fat: num().required(),
}).required();
const exercise = Joi.object({
  exerciseId: id(),
  name: title(),
  sets: num().integer().max(100),
  reps: text(),
  weight: num(),
  duration: num(),
  distance: num(),
  restSeconds: num(),
  notes: text(),
  trackingType: Joi.string().valid("STRENGTH", "CARDIO", "BODYWEIGHT", "MOBILITY", "INTERVAL", "UNCLASSIFIED"),
  prescription: Joi.object().unknown(true),
});
const completedSet = Joi.object({
  reps: num(), weight: num(), addedWeight: num(), rpe: Joi.number().min(0).max(10),
  rir: num(), completed: Joi.boolean().required(),
});
const sessionResult = Joi.object({
  sets: Joi.array().items(completedSet).min(1).max(100),
  durationMinutes: num(), distanceKm: num(), paceSecondsPerKm: num(),
  averageHeartRate: num(), inclinePercent: num(), calories: num(),
  rounds: num().integer(), workSeconds: num(), restSeconds: num(),
  distanceMetersPerRound: num(), repsPerRound: num().integer(),
  reps: num().integer(), side: Joi.string().valid("LEFT", "RIGHT", "BOTH"),
  discomfort: Joi.number().min(0).max(10), rpe: Joi.number().min(0).max(10),
}).min(1);
const sessionExercise = Joi.alternatives().try(exercise, Joi.object({
  exerciseId: id(),
  name: title(),
  trackingType: Joi.string().valid("STRENGTH", "BODYWEIGHT", "CARDIO", "INTERVAL", "MOBILITY").required(),
  prescribedSnapshot: Joi.object().unknown(true),
  result: sessionResult.required(),
  notes: text(),
}));
const sessionMeasurement = Joi.object({
  weight: num().greater(0), bodyFatPercentage: Joi.number().min(0).max(100), muscleMass: num(),
  chest: num(), waist: num(), hip: num(), arm: num(), thigh: num(), calf: num(),
}).min(1);
const day = Joi.object({
  day: Joi.number().integer().min(1).max(366).required(),
  title: text(),
  date: date().allow("", null),
  exercises: Joi.array().items(exercise).max(100).default([]),
});
const workoutSession = Joi.object({
  name: title(),
  exercises: Joi.array().items(exercise).max(100).default([]),
});
const studioExercise = Joi.object({
  exerciseId: id(), name: title(), muscleGroup: text(),
  trackingType: Joi.string().valid("STRENGTH", "CARDIO", "BODYWEIGHT", "MOBILITY", "INTERVAL").required(),
  prescription: Joi.object().unknown(true).default({}),
  weekNumber: Joi.number().integer().min(1).max(52),
  dayNumber: Joi.number().integer().min(1).max(7),
  startMinute: Joi.number().integer().min(0).max(1439),
  durationMinutes: Joi.number().integer().min(1).max(1440).default(60),
  sets: num().integer(), reps: text(), weight: Joi.alternatives().try(num(), text()),
  rpe: Joi.number().min(0).max(10), rir: num(), tempo: text(), restSeconds: num(), notes: text(),
});
const generatedExercise = Joi.object({
  draftId: id(),
  name: title(), muscleGroup: title(),
  level: Joi.string().valid("BEGINNER", "INTERMEDIATE", "ADVANCED").default("BEGINNER"),
  defaultTrackingType: Joi.string().valid("STRENGTH", "CARDIO", "BODYWEIGHT", "MOBILITY", "INTERVAL").default("STRENGTH"),
  trackingType: Joi.string().valid("STRENGTH", "CARDIO", "BODYWEIGHT", "MOBILITY", "INTERVAL"),
  equipment: Joi.alternatives().try(text(), Joi.array().items(Joi.string().trim().max(100)).max(20)),
  description: text(), technique: text(), instructions: text(),
  commonMistakes: Joi.array().items(Joi.string().trim().max(500)).max(20),
  contraindications: Joi.array().items(Joi.string().trim().max(500)).max(20),
  variants: Joi.array().items(Joi.string().trim().max(200)).max(20),
});
const meal = Joi.object({
  name: title(),
  time: Joi.string().max(10).allow(""),
  foods: text(),
  calories: num().required(),
  protein: num().required(),
  carbs: num().required(),
  fat: num().required(),
  imageId: id().allow("", null),
  imageUrl: Joi.string()
    .uri({ scheme: ["https"] })
    .allow("", null),
});
const fields: Record<GymEntity, Record<string, Joi.Schema>> = {
  customers: {
    fullName: title(),
    phone: Joi.string()
      .trim()
      .pattern(/^[+\d ().-]{7,25}$/)
      .required(),
    email: Joi.string().email().allow("", null),
    dateOfBirth: date().allow("", null),
    gender: Joi.string().valid("MALE", "FEMALE", "OTHER").default("OTHER"),
    height: num().max(300).allow(null),
    initialWeight: num().max(600).allow(null),
    medicalNotes: text(),
    initialGoal: text(),
    internalNotes: text(),
    status: Joi.string().valid("ACTIVE", "INACTIVE", "LEAD").default("ACTIVE"),
    consultations: Joi.forbidden(),
  },
  exercises: {
    name: title(),
    muscleGroup: title(),
    muscleGroups: Joi.array().items(Joi.string().trim().max(100)).max(20),
    level: Joi.string().valid("BEGINNER", "INTERMEDIATE", "ADVANCED").allow(""),
    equipment: Joi.alternatives().try(
      text(),
      Joi.array().items(Joi.string().trim().max(100)).max(20),
    ),
    description: text(),
    technique: text(),
    instructions: text(),
    commonMistakes: Joi.array().items(Joi.string().trim().max(500)).max(20),
    contraindications: Joi.array().items(Joi.string().trim().max(500)).max(20),
    variants: Joi.array().items(Joi.string().trim().max(200)).max(20),
    videoUrl: Joi.string()
      .uri({ scheme: ["http", "https"] })
      .allow(""),
    videoUrls: Joi.array()
      .items(Joi.string().uri({ scheme: ["http", "https"] }))
      .max(10),
    videos: Joi.array()
      .items(
        Joi.object({
          url: Joi.string().uri({ scheme: ["http", "https"] }).required(),
          title: text().allow(""),
          type: Joi.string().valid("YOUTUBE", "UPLOAD", "LINK").default("LINK"),
        }),
      )
      .max(10),
    trackingType: Joi.string()
      .valid("STRENGTH", "CARDIO", "BODYWEIGHT", "MOBILITY", "INTERVAL")
      .default("STRENGTH"),
  },
  "workout-templates": {
    title: title(),
    description: text(),
    goal: text(),
    level: text(),
    durationWeeks: Joi.number().integer().min(1).max(52).required(),
    durationDays: Joi.number().integer().min(1).max(365).default(28),
      muscleGroups: Joi.array().items(Joi.string().trim().max(100)).max(30).default([]),
      defaultSets: num().integer(), defaultReps: text(), defaultWeight: text(), defaultTempo: text(), technicalNotes: text(),
      scheduledExercises: Joi.array().items(studioExercise.fork(["weekNumber", "dayNumber", "startMinute"], field => field.required())).max(1000).default([]),
      unscheduledExercises: Joi.array().items(studioExercise).max(1000).default([]),
      generatedExercises: Joi.array().items(generatedExercise).max(50),
    sessions: Joi.array().items(workoutSession).max(366).default([]),
    schedule: Joi.array().items(day).max(366).default([]),
    status: Joi.string().valid("DRAFT", "ACTIVE", "ARCHIVED").default("DRAFT"),
  },
  "workout-plans": {
    customerId: id().required(),
    title: title(),
    description: text(),
    goal: text(),
    durationWeeks: Joi.number().integer().min(1).max(52).default(4),
      durationDays: Joi.number().integer().min(1).max(365),
      level: text(),
      muscleGroups: Joi.array().items(Joi.string().trim().max(100)).max(30).default([]),
      defaultSets: num().integer(), defaultReps: text(), defaultWeight: text(), defaultTempo: text(), technicalNotes: text(),
      scheduledExercises: Joi.array().items(studioExercise.fork(["weekNumber", "dayNumber", "startMinute"], field => field.required())).max(1000).default([]),
      unscheduledExercises: Joi.array().items(studioExercise).max(1000).default([]),
    startDate: date().allow("", null),
    endDate: date().allow("", null),
    sessions: Joi.array().items(workoutSession).max(366).default([]),
    schedule: Joi.array().items(day).max(366).default([]),
    status: Joi.string().valid("DRAFT", "ACTIVE", "ARCHIVED").default("ACTIVE"),
    publicationStatus: Joi.string().valid("DRAFT", "PUBLISHED").default("DRAFT"),
  },
  "progress-reports": {
    customerId: id().required(),
    periodStart: date().required(),
    periodEnd: date().required(),
    summary: Joi.string().trim().max(20000).required(),
    metrics: Joi.object().unknown(true).default({}),
    sourceVersions: Joi.object().unknown(true).default({}),
    warnings: Joi.array().items(Joi.string().trim().max(500)).max(20).default([]),
    generatorVersion: Joi.number().integer().min(1),
    status: Joi.string().valid("DRAFT", "PUBLISHED").default("DRAFT"),
  },
  "nutrition-plans": {
    customerId: id().required(),
    title: title(),
    bmr: num().allow(null),
    tdee: num().allow(null),
    targetCalories: num().greater(0).required(),
    macros,
    startDate: date().required(),
    endDate: date().required(),
      durationDays: Joi.number().integer().min(1).max(31).default(7),
      menu: Joi.array().items(Joi.alternatives().try(meal, Joi.object({
        weekNumber: Joi.number().integer().min(1).required(), name: text(), startDate: date(), endDate: date(),
        days: Joi.array().items(Joi.object({ dayNumber: Joi.number().integer().min(1).required(), date: date(), dayOfWeek: text(), meals: Joi.array().items(Joi.object().unknown(true)).max(12).default([]) })).max(7).required(),
      }))).max(100).default([]),
    dailyPlans: Joi.array().items(Joi.object().unknown(true)).max(31),
    notes: text(),
      createdByAi: Joi.boolean().default(false),
      reviewStatus: Joi.string().valid("NOT_REQUIRED", "PT_REVIEW_REQUIRED", "APPROVED", "REJECTED").default("NOT_REQUIRED"),
      status: Joi.string().valid("DRAFT", "PUBLISHED").default("DRAFT"),
  },
  "nutrition-logs": {
    customerId: id().required(),
    date: date().required(),
    type: Joi.string().valid("FOOD", "ACTIVITY").default("FOOD"),
    mealType: title(),
    foods: text(),
    calories: num().required(),
    durationMinutes: num().max(1440),
    protein: num(),
    carbs: num(),
    fat: num(),
    notes: text(),
  },
  measurements: {
    customerId: id().required(),
    status: Joi.string().valid("DRAFT", "PUBLISHED").default("DRAFT"),
    source: Joi.string().valid("MANUAL", "OCR").default("MANUAL"),
    measurementDate: date().required(),
    weight: num().greater(0).max(600).required(),
    height: num().max(300),
    bmi: num(),
    bodyFatPercentage: num().max(100),
    bodyFatMass: num(),
    muscleMass: num(),
    bmr: num(),
    visceralFatLevel: num(),
    inbodyScore: num().max(100),
    bodyWater: num().max(200),
    boneMineral: num().max(50),
    waistHipRatio: num().max(5),
    segmentalMuscle: Joi.object().unknown(true).allow(null),
    segmentalFat: Joi.object().unknown(true).allow(null),
    waist: num(),
    hip: num(),
    chest: num(),
    consultationNotes: text(),
    notes: text(),
  },
  goals: {
    customerId: id().required(),
    title: title(),
    type: Joi.string().valid("WEIGHT_LOSS", "FAT_LOSS", "WEIGHT_GAIN", "MUSCLE_GAIN", "RECOMPOSITION", "FITNESS").required(),
    targetValue: Joi.number().allow(null),
    targetUnit: text(),
    deadline: date().required(),
    sessionsPerWeek: Joi.number().integer().min(1).max(14).required(),
    cardioNotes: text(),
    evaluationNotes: text(),
    status: Joi.string().valid("DRAFT", "PUBLISHED").default("DRAFT"),
  },
  roadmaps: {
    customerId: id().required(),
    title: title(),
      startDate: date().allow("", null),
      endDate: date().allow("", null),
    strategy: Joi.object().unknown(true).allow(null),
    baseline: Joi.object().unknown(true).allow(null),
    phases: Joi.array()
      .items(
          Joi.alternatives().try(Joi.object({
          title: title(),
          startDate: date().required(),
          endDate: date().required(),
          goals: text(),
          notes: text(),
          weeks: Joi.array().items(Joi.object().unknown(true)).max(52),
          }), Joi.object({
            order: Joi.number().integer().min(1).max(52).required(),
            name: title(),
            durationWeeks: Joi.number().integer().min(1).max(52).required(),
            goals: Joi.array().items(Joi.string().trim().max(500)).max(30).default([]),
            weeks: Joi.array().items(Joi.object({
              week: Joi.number().integer().min(1).max(52).required(),
              focus: Joi.string().trim().max(2000).allow("").default(""),
              sessionTargets: Joi.number().integer().min(0).max(14).allow(null),
              sessions: Joi.array().items(Joi.object().unknown(true)).max(14).default([]),
            })).max(52).default([]),
          })),
      )
      .min(1)
      .max(52)
      .required(),
    status: Joi.string().valid("DRAFT", "PUBLISHED").default("DRAFT"),
    notes: text(),
  },
  sessions: {
    customerId: id().required(),
    planId: id().required(),
    planRevision: Joi.number().integer().min(1),
    sessionIndex: Joi.number().integer().min(0),
    idempotencyKey: Joi.string().trim().max(100),
    performedAt: date().required(),
    attendance: Joi.string().valid("PRESENT", "ABSENT", "LATE").required(),
    absenceReason: text(),
    exerciseLogs: Joi.array().items(sessionExercise).max(100).default([]),
    bodyMeasurement: sessionMeasurement,
    progressPhotos: Joi.array().items(Joi.object({
      photoUrl: Joi.string().uri({ scheme: ["https"] }).required(),
      angle: Joi.string().valid("FRONT", "SIDE", "BACK", "OTHER").required(),
    })).max(4),
    customerSignature: Joi.object({
      signatureUrl: Joi.string().pattern(/^data:image\/png;base64,/).max(250000).required(),
      signerName: Joi.string().trim().max(200).allow(""),
      signedAt: date(),
    }),
    feeling: text(),
    notes: text(),
  },
  "progress-photos": {
    customerId: id().required(),
    photoUrl: Joi.string().uri({ scheme: ["https"] }).required(),
    takenDate: date().required(),
    stage: Joi.string().valid("BEFORE", "PROGRESS", "AFTER").default("PROGRESS"),
    angle: Joi.string().valid("FRONT", "SIDE", "BACK", "OTHER").default("FRONT"),
    weight: Joi.number().min(0).allow(null),
    bodyFat: Joi.number().min(0).max(100).allow(null),
    notes: text(),
  },
  "package-templates": {
    name: title(),
    totalSessions: Joi.number().integer().min(1).max(10000).required(),
    durationDays: Joi.number().integer().min(1).max(3650).required(),
    price: Joi.number().min(0).max(1_000_000_000_000).default(0),
    status: Joi.string().valid("ACTIVE", "INACTIVE").default("ACTIVE"),
    description: text(),
  },
  packages: {
    status: Joi.string()
      .valid("ACTIVE", "EXPIRED", "COMPLETED", "CANCELLED")
      .default("ACTIVE"),
    customerId: id().required(),
    name: title(),
    totalSessions: Joi.number().integer().min(1).max(10000).required(),
    startDate: date().required(),
    endDate: date().required(),
    notes: text(),
  },
  transfers: {
    customerId: id().required(),
    toPtId: id().required(),
    reason: title(),
  },
  knowledge: {
    title: title(),
    topic: title(),
    content: Joi.string().trim().max(200000).required(),
  },
  "food-images": {
    calories: num().allow(null),
    protein: num().allow(null),
    carbs: num().allow(null),
    fat: num().allow(null),
    servingLabel: text(),
    servingGrams: num(),
    cookingNote: text(),
    prompt: text(),
    imageUrl: Joi.string().uri({ scheme: ["https"] }).allow("", null),
    source: Joi.string().valid("UPLOAD", "AI", "SYSTEM").default("UPLOAD"),
    name: title(),
    category: text(),
    keywords: Joi.array()
      .items(Joi.string().trim().max(100))
      .max(40)
      .default([]),
  },
};
export function validateInput(entity: GymEntity, input: unknown) {
  const schema = Joi.object({
    ...fields[entity],
    revision: Joi.number().integer().min(0),
  }).unknown(false);
  const result = schema.validate(input, { abortEarly: false });
  if (result.error)
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Vui lòng kiểm tra thông tin đã nhập.",
      { fields: result.error.details.map((d) => d.path.join(".")) },
    );
  const value = result.value;
  if (value.startDate && value.endDate && value.endDate < value.startDate)
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Ngày kết thúc phải sau ngày bắt đầu.",
    );
  if (value.dateOfBirth && Date.parse(value.dateOfBirth) > Date.now())
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Ngày sinh không được ở tương lai.",
    );
  for (const phase of value.phases || [])
    if (
      (phase.startDate && phase.endDate && phase.endDate < phase.startDate) ||
      (phase.startDate && value.startDate && phase.startDate < value.startDate) ||
      (phase.endDate && value.endDate && phase.endDate > value.endDate)
    )
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Giai đoạn phải nằm trong thời gian lộ trình.",
      );
  return value as Record<string, any>;
}
