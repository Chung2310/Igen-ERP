import { parseApiErrorResponse } from "../../services/apiClientError";
import type { ArchitectureImageToolKind, ArchitectureProject, ArchitectureProjectInput, ArchitectureVideoJob } from "../../shared/architecture-assistant";

export function architectAssistantApi(branchId: string) {
  async function request(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    const token = localStorage.getItem("accessToken");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-branch-id", branchId);
    if (typeof options.body === "string") headers.set("Content-Type", "application/json");
    const response = await fetch(`/api/v1/architect-assistant${path}`, { ...options, headers, cache: "no-store" });
    if (!response.ok) throw await parseApiErrorResponse(response);
    return response;
  }

  return {
    list: async () => (await request("/projects")).json() as Promise<{ projects: ArchitectureProject[] }>,
    create: async (input: ArchitectureProjectInput) => (await request("/projects", {
      method: "POST", body: JSON.stringify(input),
    })).json() as Promise<{ project: ArchitectureProject }>,
    update: async (projectId: string, revision: number, changes: Partial<ArchitectureProject>) =>
      (await request(`/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH", body: JSON.stringify({ ...changes, revision }),
      })).json() as Promise<{ project: ArchitectureProject }>,
    remove: async (projectId: string, revision: number) =>
      (await request(`/projects/${encodeURIComponent(projectId)}?revision=${revision}`, { method: "DELETE" })).json() as Promise<{ success: true }>,
    generatePlan: async (projectId: string) => (await request(`/projects/${encodeURIComponent(projectId)}/generate-plan`, {
      method: "POST", body: JSON.stringify({}),
    })).json() as Promise<{ project: ArchitectureProject }>,
    render: async (projectId: string, planImage: string, aspectRatio: string, prompt: string, floor: number) =>
      (await request(`/projects/${encodeURIComponent(projectId)}/render`, {
        method: "POST", body: JSON.stringify({ planImage, aspectRatio, prompt, floor }),
      })).json() as Promise<{ project: ArchitectureProject }>,
    generateImage: async (projectId: string, input: { kind: ArchitectureImageToolKind; prompt: string; aspectRatio: string; referenceImage?: string }) =>
      (await request(`/projects/${encodeURIComponent(projectId)}/generate-image`, {
        method: "POST", body: JSON.stringify(input),
      })).json() as Promise<{ project: ArchitectureProject }>,
    optimizePrompt: async (projectId: string, input: { tool: string; prompt: string; style: string }) =>
      (await request(`/projects/${encodeURIComponent(projectId)}/optimize-prompt`, {
        method: "POST", body: JSON.stringify(input),
      })).json() as Promise<{ prompt: string }>,
    createVideo: async (projectId: string, input: { prompt: string; aspectRatio: string; duration: number; resolution: string; generateAudio: boolean; referenceImage?: string }) =>
      (await request(`/projects/${encodeURIComponent(projectId)}/videos`, {
        method: "POST", body: JSON.stringify(input),
      })).json() as Promise<{ project: ArchitectureProject; job: ArchitectureVideoJob }>,
    videoStatus: async (projectId: string, jobId: string) =>
      (await request(`/projects/${encodeURIComponent(projectId)}/videos/${encodeURIComponent(jobId)}`)).json() as Promise<{ project: ArchitectureProject; job: ArchitectureVideoJob }>,
    asset: async (projectId: string, assetId: string) =>
      (await request(`/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`)).blob(),
  };
}

export type ArchitectAssistantApi = ReturnType<typeof architectAssistantApi>;
