export const gymEntities = [
  "customers",
  "exercises",
  "workout-templates",
  "workout-plans",
  "progress-reports",
  "progress-photos",
  "package-templates",
  "nutrition-plans",
  "nutrition-logs",
  "measurements",
  "goals",
  "roadmaps",
  "sessions",
  "packages",
  "transfers",
  "knowledge",
  "food-images",
] as const;
export type GymEntity = (typeof gymEntities)[number];
export interface GymRecord {
  _id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  // Entity payloads are validated against the server's explicit Joi schemas.
  [field: string]: any;
}
export interface GymList {
  data: GymRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export interface GymTrainer {
  _id: string;
  displayName: string;
  email: string;
  role: string;
  customerCount: number;
  phone?: string;
  status?: "ACTIVE" | "LOCKED";
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  specialization?: string;
  yearsOfExperience?: number;
  certificates?: string[];
  bio?: string;
  avatarUrl?: string;
  revision?: number;
}
export const gymCollections: Record<GymEntity, string> = {
  customers: "gym_customers",
  exercises: "gym_exercises",
  "workout-templates": "gym_workout_templates",
  "workout-plans": "gym_workout_plans",
  "progress-reports": "gym_progress_reports",
  "progress-photos": "gym_progress_photos",
  "package-templates": "gym_package_templates",
  "nutrition-plans": "gym_nutrition_plans",
  "nutrition-logs": "gym_nutrition_logs",
  measurements: "gym_measurements",
  goals: "gym_goals",
  roadmaps: "gym_roadmaps",
  sessions: "gym_workout_sessions",
  packages: "gym_pt_packages",
  transfers: "gym_transfers",
  knowledge: "gym_knowledge_documents",
  "food-images": "gym_food_images",
};
export const customerEntities = new Set<GymEntity>([
  "workout-plans",
  "progress-reports",
  "progress-photos",
  "nutrition-plans",
  "nutrition-logs",
  "measurements",
  "goals",
  "roadmaps",
  "sessions",
  "packages",
]);
export const gymAdmin = (role: string) =>
  role === "admin" || role === "superadmin";
export const gymTabs = [
  ["customers", "Khách hàng"],
  ["measurements", "Chỉ số InBody"],
  ["nutrition-plans", "Dinh dưỡng"],
  ["roadmaps", "Lộ trình"],
  ["workout-templates", "Giáo án"],
  ["progress", "Tiến độ"],
  ["knowledge", "Kho tri thức"],
  ["trainers", "Huấn luyện viên"],
  ["transfers", "Điều chuyển"],
] as const;
export type GymTab = (typeof gymTabs)[number][0];
