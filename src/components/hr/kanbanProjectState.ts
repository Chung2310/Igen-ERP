import type { Project } from "../../types";

export function mergeSavedProject(current: Project[], saved: Partial<Project> & { _id?: string }, editingProjectId: string | null) {
  const normalized = { ...saved, id: saved._id || saved.id } as Project;
  return editingProjectId
    ? current.map((project) => project.id === editingProjectId ? normalized : project)
    : [normalized, ...current];
}

export function shouldApplyProjectResponse(requestGeneration: number, currentGeneration: number) {
  return requestGeneration === currentGeneration;
}
