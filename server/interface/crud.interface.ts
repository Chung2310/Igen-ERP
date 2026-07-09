export type SupportedModelName =
  | "products"
  | "categories"
  | "stock-logs"
  | "crm-tickets"
  | "marketing-contents"
  | "projects"
  | "kanban-tasks"
  | "training-courses"
  | "training-enrollments"
  | "social-integrations"
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
