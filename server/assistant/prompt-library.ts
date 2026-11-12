import Joi from "joi";
import { Types } from "mongoose";
import { assistantPromptCategories, starterAssistantPromptTemplates, type AssistantPromptTemplate } from "../../src/components/common/assistant-prompt-library-data";
import { AssistantPromptTemplateModel, ensureAssistantIndexes } from "./models";
import { AssistantError } from "./policy";

type PromptLibraryScope = { companyCode: string; userId: string };
type PromptTemplateRecord = {
  templateId: string;
  owner: "igen" | "user";
  title: string;
  description: string;
  category: string;
  prompt: string;
  favoriteBy: string[];
};

function toTemplate(record: PromptTemplateRecord): AssistantPromptTemplate {
  return {
    id: record.templateId,
    owner: record.owner,
    title: record.title,
    description: record.description,
    category: record.category,
    prompt: record.prompt,
  };
}

async function seedIgenTemplates(companyCode: string) {
  await AssistantPromptTemplateModel.bulkWrite(starterAssistantPromptTemplates.map(template => ({
    updateOne: {
      filter: { companyCode, templateId: template.id },
      update: {
        $set: {
          userId: "SYSTEM",
          owner: "igen" as const,
          title: template.title,
          description: template.description,
          category: template.category,
          prompt: template.prompt,
        },
        $setOnInsert: { favoriteBy: [] },
      },
      upsert: true,
    },
  })), { ordered: false });
}

export const assistantPromptTemplateCreateSchema = Joi.object({
  title: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(180).allow("").default(""),
  category: Joi.string().valid(...assistantPromptCategories.filter(category => category !== "Tất cả")).required(),
  prompt: Joi.string().trim().min(1).max(5000).required(),
}).unknown(false);

export const assistantPromptTemplateFavoriteSchema = Joi.object({
  favorite: Joi.boolean().required(),
}).unknown(false);

export async function listAssistantPromptTemplates(scope: PromptLibraryScope) {
  await ensureAssistantIndexes();
  await seedIgenTemplates(scope.companyCode);
  const rows = await AssistantPromptTemplateModel.find({
    companyCode: scope.companyCode,
    $or: [{ owner: "igen" as const }, { owner: "user" as const, userId: scope.userId }],
  }).sort({ owner: 1, updatedAt: -1, title: 1 }).lean() as unknown as Array<PromptTemplateRecord>;

  return {
    templates: rows.map(toTemplate),
    favoriteIds: rows.filter(template => template.favoriteBy.includes(scope.userId)).map(template => template.templateId),
  };
}

export async function createAssistantPromptTemplate(scope: PromptLibraryScope, input: {
  title: string;
  description?: string;
  category: string;
  prompt: string;
}) {
  await ensureAssistantIndexes();
  const record = await AssistantPromptTemplateModel.create({
    companyCode: scope.companyCode,
    userId: scope.userId,
    templateId: new Types.ObjectId().toHexString(),
    owner: "user",
    title: input.title.trim(),
    description: input.description?.trim() || "Mẫu câu lệnh do bạn tạo.",
    category: input.category,
    prompt: input.prompt.trim(),
    favoriteBy: [],
  });
  return toTemplate(record.toObject() as unknown as PromptTemplateRecord);
}

export async function setAssistantPromptTemplateFavorite(scope: PromptLibraryScope, templateId: string, favorite: boolean) {
  await ensureAssistantIndexes();
  const access = {
    companyCode: scope.companyCode,
    templateId,
    $or: [{ owner: "igen" as const }, { owner: "user" as const, userId: scope.userId }],
  };
  const record = await AssistantPromptTemplateModel.findOneAndUpdate(
    access,
    favorite ? { $addToSet: { favoriteBy: scope.userId } } : { $pull: { favoriteBy: scope.userId } },
    { new: true, projection: { favoriteBy: 1 } },
  ).lean() as { favoriteBy: string[] } | null;
  if (!record) throw new AssistantError("Không tìm thấy mẫu câu lệnh hoặc bạn không có quyền truy cập.", 404);
  return { favorite: record.favoriteBy.includes(scope.userId) };
}
