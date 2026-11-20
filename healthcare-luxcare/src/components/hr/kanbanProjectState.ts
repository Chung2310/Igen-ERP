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

export function updateProjectProgressFromTasks(
  projects: Project[],
  tasks: Array<{ projectId?: string; status?: string }>,
  affectedProjectIds: Array<string | undefined>,
) {
  const affected = new Set(affectedProjectIds.filter(Boolean));
  return projects.map((project) => {
    if (!affected.has(project.id)) return project;
    const eligible = tasks.filter((task) => task.projectId === project.id && task.status !== "Archived");
    const completed = eligible.filter((task) => task.status === "Done" || task.status === "done").length;
    return { ...project, progress: { completed, total: eligible.length, percent: eligible.length ? Math.round(completed * 100 / eligible.length) : 0 } };
  });
}
