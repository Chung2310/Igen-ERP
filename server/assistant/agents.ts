import Joi from "joi";
import type { AuthenticatedRequest } from "../middleware/auth";
import { UserAssistantAgentModel, ensureAssistantIndexes } from "./models";
import { actorScope } from "./workflows";
import { AssistantError } from "./policy";

const agentId = Joi.string().guid({ version: ["uuidv4"] }).required();
const knowledgeItem = Joi.object({
  id: agentId,
  title: Joi.string().trim().max(120).required(),
  kind: Joi.string().valid("text", "link", "file").required(),
  content: Joi.string().max(30000).required(),
  createdAt: Joi.string().isoDate().required(),
}).unknown(false);

export const assistantAgentFieldsSchema = Joi.object({
  name: Joi.string().trim().max(50).required(),
  description: Joi.string().trim().max(150).allow("").required(),
  instructions: Joi.string().trim().min(1).max(10000).required(),
  avoid: Joi.string().allow("").max(2000).required(),
  tone: Joi.string().max(60).required(),
  avatar: Joi.number().integer().min(0).max(5).required(),
  favorite: Joi.boolean().required(),
  openingQuestions: Joi.array().max(5).items(Joi.string().max(160).allow("")).required(),
  knowledge: Joi.array().max(20).items(knowledgeItem).required(),
}).unknown(false);

export const createAssistantAgentSchema = assistantAgentFieldsSchema.append({ id: agentId });
export const updateAssistantAgentFavoriteSchema = Joi.object({ favorite: Joi.boolean().required() }).unknown(false);

type AssistantAgentFields = {
  name: string;
  description: string;
  instructions: string;
  avoid: string;
  tone: string;
  avatar: number;
  favorite: boolean;
  openingQuestions: string[];
  knowledge: Array<{ id: string; title: string; kind: "text" | "link" | "file"; content: string; createdAt: string }>;
};

function agentScope(req: AuthenticatedRequest) {
  return actorScope(req);
}

function toPublicAgent(row: any) {
  return {
    id: String(row.agentId),
    name: row.name,
    description: row.description || "",
    instructions: row.instructions,
    avoid: row.avoid || "",
    tone: row.tone || "Tự động",
    avatar: Number.isInteger(row.avatar) ? row.avatar : 0,
    favorite: row.favorite === true,
    openingQuestions: Array.isArray(row.openingQuestions) ? row.openingQuestions : [],
    knowledge: Array.isArray(row.knowledge) ? row.knowledge : [],
  };
}

export async function listUserAssistantAgents(req: AuthenticatedRequest) {
  const scope = agentScope(req);
  await ensureAssistantIndexes();
  const rows = await UserAssistantAgentModel.find(scope).sort({ updatedAt: -1, _id: -1 }).lean();
  return { agents: rows.map(toPublicAgent) };
}

export async function createUserAssistantAgent(req: AuthenticatedRequest, id: string, fields: AssistantAgentFields) {
  const scope = agentScope(req);
  await ensureAssistantIndexes();
  const existing = await UserAssistantAgentModel.exists({ ...scope, agentId: id });
  if (!existing && await UserAssistantAgentModel.countDocuments(scope) >= 50) {
    throw new AssistantError("Mỗi tài khoản có thể lưu tối đa 50 trợ lý.", 409);
  }
  const row = await UserAssistantAgentModel.findOneAndUpdate(
    { ...scope, agentId: id },
    { $set: fields, $setOnInsert: { ...scope, agentId: id } },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  ).lean();
  return toPublicAgent(row);
}

export async function updateUserAssistantAgent(req: AuthenticatedRequest, id: string, fields: AssistantAgentFields) {
  const scope = agentScope(req);
  await ensureAssistantIndexes();
  const row = await UserAssistantAgentModel.findOneAndUpdate(
    { ...scope, agentId: id }, { $set: fields }, { returnDocument: "after", runValidators: true },
  ).lean();
  if (!row) throw new AssistantError("Không tìm thấy trợ lý hoặc bạn không có quyền truy cập.", 404);
  return toPublicAgent(row);
}

export async function setUserAssistantAgentFavorite(req: AuthenticatedRequest, id: string, favorite: boolean) {
  const scope = agentScope(req);
  await ensureAssistantIndexes();
  const row = await UserAssistantAgentModel.findOneAndUpdate(
    { ...scope, agentId: id }, { $set: { favorite } }, { returnDocument: "after", runValidators: true },
  ).lean();
  if (!row) throw new AssistantError("Không tìm thấy trợ lý hoặc bạn không có quyền truy cập.", 404);
  return toPublicAgent(row);
}

export async function deleteUserAssistantAgent(req: AuthenticatedRequest, id: string) {
  const scope = agentScope(req);
  await ensureAssistantIndexes();
  const result = await UserAssistantAgentModel.deleteOne({ ...scope, agentId: id });
  if (!result.deletedCount) throw new AssistantError("Không tìm thấy trợ lý hoặc bạn không có quyền truy cập.", 404);
  return { id };
}
