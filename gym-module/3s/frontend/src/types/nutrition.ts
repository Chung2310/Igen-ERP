export interface MacroNutrients {
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroCalories {
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
}

export interface MacroPercentages {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

export interface CalculatedNutrition {
  formula: string;
  bmr: number;
  tdee: number;
  targetCalories: number;
  deficitOrSurplus: number;
  goal: string;
  goalLabel: string;
  macros: MacroNutrients;
  macroCalories: MacroCalories;
  macroPercentages: MacroPercentages;
  waterLiters: number;
}

export interface TimingStrategyItem {
  time: string;
  meal: string;
  focus: string;
  calorieTarget: number;
}

export interface DietaryAdvice {
  recommendedFoods?: string[];
  avoidFoods?: string[];
  supplements?: string[];
  keyNotes?: string;
}

export interface AiNutritionAnalysisResult {
  summary: string;
  bmr: number;
  tdee: number;
  targetCalories: number;
  deficitOrSurplus: number;
  goalLabel: string;
  macros: MacroNutrients;
  macroCalories: MacroCalories;
  macroPercentages: MacroPercentages;
  waterLiters: number;
  timingStrategy?: TimingStrategyItem[];
  dietaryAdvice?: DietaryAdvice;
}


export type ActivityCategory = 'STRENGTH' | 'CARDIO' | 'MARTIAL_ARTS' | 'SPORTS' | 'RECOVERY';

export interface ActivityItem {
  id: string;
  name: string;
  category: ActivityCategory;
  categoryLabel: string;
  met: number;
  icon?: any;
  defaultDurationMinutes: number;
  defaultDistanceKm?: number;
  benchmarkText: string;
  description: string;
  badgeColor: string;
}

export type FoodCategory = 'protein' | 'carbs' | 'fat' | 'veggies';

export interface FoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  categoryLabel: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  unit: string;
  defaultServingGrams: number;
  servingLabel?: string;
  prepTip?: string;
}

export interface MealDishPill {
  label: string;
  weight?: string;
  val?: string;
  highlight?: boolean;
}

export interface MealDishItem {
  id: number;
  title: string;
  image?: string | null;
  leftPills?: Array<{ label: string; weight: string }>;
  rightPills?: Array<{ label: string; val: string; highlight?: boolean }>;
}

export interface NutritionDraftPlan {
  _id?: string;
  title: string;
  targetCalories: number;
  macros: MacroNutrients;
  menu: unknown[];
  reviewStatus: string;
  posterDishes?: MealDishItem[];
  advice?: string;
  startDate?: string | null;
  endDate?: string | null;
  durationDays?: number | null;
}

export interface NutritionLogItem {
  _id?: string;
  customerId: string;
  ptId?: string;
  loggedAt: string;
  type: 'FOOD' | 'ACTIVITY';
  name: string;
  calories: number;
  durationMinutes?: number;
  macros?: Partial<MacroNutrients>;
  notes?: string;
}

export interface NutritionSummary {
  consumedCalories?: number;
  burnedCalories?: number;
  netCalories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}
