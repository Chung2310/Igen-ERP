export interface SegmentalMap {
  rightArm?: number | null;
  leftArm?: number | null;
  trunk?: number | null;
  rightLeg?: number | null;
  leftLeg?: number | null;
}

export interface InBodyRecordData {
  _id?: string;
  customerId?: { _id: string; fullName: string; phone?: string; gender?: string; height?: number } | string;
  ptId?: string;
  measurementDate: string;
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
  segmentalMuscle?: SegmentalMap | null;
  segmentalFat?: SegmentalMap | null;
  consultationNotes?: string;
  strengths?: string;
  priorities?: string;
  recommendation?: string;
  source?: 'MANUAL' | 'AI_SCAN';
  status?: 'DRAFT' | 'PUBLISHED';
  ocrStatus?: 'NOT_APPLICABLE' | 'REVIEW_REQUIRED' | 'CONFIRMED';
  confidence?: number | null;
  ocrWarnings?: string[];
  publishedAt?: string | null;
  createdAt?: string;
}

export interface MetricClassification {
  status: 'UNDER' | 'NORMAL' | 'OVER';
  label: string;
  badgeClass: string;
  color: string;
  description: string;
}

export interface HealthAlert {
  id: string;
  title: string;
  desc: string;
  level: 'danger' | 'warning' | 'info' | 'success';
}

export interface InBodyComparison {
  daysBetween: number;
  deltaWeight: number;
  deltaFatPercentage: number;
  deltaFatMass: number | null;
  deltaMuscleMass: number;
  deltaVisceralFat: number;
  deltaScore: number;
  trendSummary: string;
  trendType: 'EXCELLENT' | 'GOOD' | 'NEUTRAL' | 'NEEDS_ADJUSTMENT';
}

export interface CustomerGoalData {
  _id?: string;
  type?: string;
  title?: string;
  targetValue?: number | null;
  targetUnit?: string;
  deadline?: string;
  sessionsPerWeek?: number;
  cardioNotes?: string;
  evaluationNotes?: string;
  status?: string;
}

export interface InBodyGoalAlignment {
  goal: CustomerGoalData;
  goalTypeLabel: string;
  progressStatus: 'ON_TRACK' | 'AHEAD' | 'NEEDS_FOCUS';
  statusSummary: string;
  recommendation: string;
}

export interface InBodyAnalysisResult {
  classifications: {
    bmi?: MetricClassification;
    bodyFat?: MetricClassification;
    muscleMass?: MetricClassification;
    visceralFat?: MetricClassification;
    inbodyScore?: MetricClassification;
  };
  strengths: string[];
  improvements: string[];
  priorities: string[];
  alerts: HealthAlert[];
  segmentalAnalysis: {
    muscleImbalanceArm: { hasImbalance: boolean; diffPct: number; note?: string };
    muscleImbalanceLeg: { hasImbalance: boolean; diffPct: number; note?: string };
    trunkSummary: string;
  };
  consultationGuide: {
    talkingPoints: string[];
    nutritionAdvice: string;
    workoutAdvice: string;
    targetCaloriesRecommendation: {
      maintenance: number;
      fatLoss: number;
      muscleGain: number;
    };
    proteinRecommendation: string;
    waterRecommendation: string;
  };
  quickMessage: string;
  comparison?: InBodyComparison | null;
  goalAlignment?: InBodyGoalAlignment | null;
}

export interface InBodyOcrDraft {
  _id: string;
  customerId?: string | null;
  ptId?: string | null;
  detectedCustomerName?: string | null;
  measurementDate: string;
  weight?: number;
  height?: number | null;
  bmi?: number;
  bodyFatPercentage?: number;
  bodyFatMass?: number;
  muscleMass?: number;
  bmr?: number;
  visceralFatLevel?: number;
  inbodyScore?: number;
  bodyWater?: number;
  boneMineral?: number;
  waistHipRatio?: number;
  segmentalMuscle?: SegmentalMap | null;
  segmentalFat?: SegmentalMap | null;
  confidence?: number;
  ocrWarnings?: string[];
  warnings?: string[];
  status: 'DRAFT';
  ocrStatus: 'REVIEW_REQUIRED' | 'CONFIRMED';
}
