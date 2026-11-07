const MANAGER_ROLES = new Set(["superadmin", "admin", "manager", "branch_owner"]);
const TASK_STATUSES = new Set(["Not Started", "In Progress", "Review/Testing", "Done", "Archived"]);
const PROJECT_STATUSES = new Set(["not_started", "in_progress", "paused", "completed", "cancelled"]);
const PROJECT_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

function escapedTerm(value: unknown) {
  const term = String(value || "").trim().slice(0, 100);
  return term ? term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
}

function validDay(value: unknown): string | undefined {
  const day = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const parsed = new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day : undefined;
}

function addDateRange(filter: Record<string, any>, field: string, fromValue: unknown, toValue: unknown) {
  const from = validDay(fromValue);
  const to = validDay(toValue);
  const range: Record<string, Date> = {};
  if (from) range.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) {
    const exclusiveEnd = new Date(`${to}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    range.$lt = exclusiveEnd;
  }
  if (from && to && from > to) return;
  if (Object.keys(range).length) filter[field] = range;
}

export function buildKanbanTaskListFilter(
  query: Record<string, unknown>,
  user: { id?: string; role?: string },
): Record<string, unknown> {
  const filter: Record<string, any> = {};
  const clauses: Record<string, unknown>[] = [];
  if (!MANAGER_ROLES.has(String(user.role || ""))) {
    clauses.push({ $or: [{ assigneeUid: user.id }, { creatorUid: user.id }] });
  }

  const search = escapedTerm(query.search);
  if (search) clauses.push({ $or: ["title", "description", "assignee", "category"].map(field => ({ [field]: { $regex: search, $options: "i" } })) });

  const status = String(query.status || "").trim();
  if (TASK_STATUSES.has(status)) filter.status = status;
  const priority = String(query.priority || "").trim();
  if (["High", "Medium", "Low"].includes(priority)) filter.priority = priority;

  for (const [key, field] of [["assigneeUid", "assigneeUid"], ["projectId", "projectId"]]) {
    const value = String(query[key] || "").trim();
    if (value && value.length <= 100) filter[field] = value;
  }
  const dueFrom = validDay(query.dueFrom);
  const dueTo = validDay(query.dueTo);
  if ((!dueFrom || !dueTo || dueFrom <= dueTo) && (dueFrom || dueTo)) {
    filter.dueDate = {
      ...(dueFrom ? { $gte: dueFrom } : {}),
      ...(dueTo ? { $lte: `${dueTo}T23:59:59.999Z` } : {}),
    };
  }
  if (clauses.length) filter.$and = clauses;
  return filter;
}

export function buildKanbanProjectListFilter(query: Record<string, unknown>): Record<string, unknown> {
  const filter: Record<string, any> = {};
  const clauses: Record<string, unknown>[] = [];
  const search = escapedTerm(query.search);
  if (search) clauses.push({ name: { $regex: search, $options: "i" } });

  const status = String(query.status || "").trim();
  if (PROJECT_STATUSES.has(status)) filter.status = status;
  const priority = String(query.priority || "").trim();
  if (PROJECT_PRIORITIES.has(priority)) filter.priority = priority;
  addDateRange(filter, "startAt", query.startFrom, query.startTo);
  addDateRange(filter, "dueAt", query.dueFrom, query.dueTo);
  if (clauses.length) filter.$and = clauses;
  return filter;
}
