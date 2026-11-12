import type { AuthenticatedRequest } from "../middleware/auth";
import { AssistantProjectCollectionModel, ensureAssistantIndexes } from "./models";
import { actorScope } from "./workflows";
import { AssistantError } from "./policy";

const projectScope = (req: AuthenticatedRequest) => ({ ...actorScope(req), branchId: req.user?.branchId || "" });

export async function listAssistantProjects(req: AuthenticatedRequest) {
  await ensureAssistantIndexes();
  const collection = await AssistantProjectCollectionModel.findOne(projectScope(req)).select("projects").lean();
  return Array.isArray(collection?.projects) ? collection.projects : [];
}

export async function saveAssistantProjectCollection(req: AuthenticatedRequest, projects: unknown[]) {
  await ensureAssistantIndexes();
  const scope = projectScope(req);
  await AssistantProjectCollectionModel.updateOne(scope, { $set: { projects }, $setOnInsert: scope }, { upsert: true });
  return projects;
}

export async function projectInstructionsForConversation(req: AuthenticatedRequest, projectId: string, conversationId: string) {
  const projects = await listAssistantProjects(req);
  const project = projects.find((item: any) => item.id === projectId);
  if (!project || !Array.isArray(project.conversations) || !project.conversations.some((item: any) => item.sourceConversationId === conversationId)) {
    throw new AssistantError("Cuộc trò chuyện không thuộc dự án này.", 403);
  }
  return typeof project.instructions === "string" ? project.instructions.slice(0, 10000) : "";
}
