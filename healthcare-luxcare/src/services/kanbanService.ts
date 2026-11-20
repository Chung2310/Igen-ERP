import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
import type { HRTask, Project } from "../types/hr";
export type TaskInput = Pick<HRTask, "title" | "assigneeUid" | "dueDate"> &
  Partial<
    Pick<
      HRTask,
      | "description"
      | "priority"
      | "status"
      | "projectId"
      | "startTime"
      | "endTime"
      | "estTime"
      | "actualTime"
      | "linkNote"
    >
  >;
export type TaskUpdate = Partial<TaskInput> & {
  expectedRevision?: number;
  subtasks?: HRTask["subtasks"];
  attachments?: HRTask["attachments"];
};
export type ProjectInput = Pick<Project, "name" | "status" | "priority"> & Partial<Pick<Project, "startAt" | "dueAt">>;
export function createKanbanService({ fetch, getAccessToken }: ServiceTransport) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers });
    if (!response.ok) throw await parseApiErrorResponse(response);
    const body = await response.json().catch(() => ({}));
    return body.data as T;
  }
  const normalize = <T extends { id: string }>(record: T & { _id?: string }): T => ({
    ...record,
    id: record._id || record.id,
  });
  const suffix = (branchId?: string) => (branchId ? `?branchId=${encodeURIComponent(branchId)}` : "");
  return {
    listTasks: async (branchId?: string): Promise<HRTask[]> =>
      ((await request<(HRTask & { _id?: string })[]>(`/api/v1/kanban/tasks${suffix(branchId)}`)) || []).map(normalize),
    listProjects: async (branchId?: string): Promise<Project[]> =>
      (
        (await request<(Project & { _id?: string })[]>(`/api/v1/kanban/projects${suffix(branchId)}`, {
          cache: "no-store",
        })) || []
      ).map(normalize),
    createTask: async (input: TaskInput): Promise<HRTask> =>
      normalize(await request<HRTask>("/api/v1/kanban/tasks", { method: "POST", body: JSON.stringify(input) })),
    updateTask: async (id: string, input: TaskUpdate): Promise<HRTask> =>
      normalize(
        await request<HRTask>(`/api/v1/kanban/tasks/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        }),
      ),
    removeTask: async (id: string) => {
      await request(`/api/v1/kanban/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    createProject: async (input: ProjectInput): Promise<Project> =>
      normalize(await request<Project>("/api/v1/kanban/projects", { method: "POST", body: JSON.stringify(input) })),
    updateProject: async (
      id: string,
      input: Partial<ProjectInput> & { attachments?: Project["attachments"] },
    ): Promise<Project> =>
      normalize(
        await request<Project>(`/api/v1/kanban/projects/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        }),
      ),
    removeProject: async (id: string): Promise<void> => {
      await request(`/api/v1/kanban/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
export const kanbanService = createKanbanService(browserTransport);
