export type SupportedModelName =
  | "products"
  | "categories"
  | "stock-logs"
  | "projects"
  | "kanban-tasks"
  | "training-courses"
  | "training-enrollments"
  | "workflows"
  | "users"
  | "hr-calendar-events"
  | "timekeeping-logs";

export interface ICRUDQueryOptions {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  filters?: Record<string, any>;
}
