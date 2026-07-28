import { randomUUID } from "node:crypto";
import { RecruitmentApplicantModel } from "../model/recruitment-applicant.model";
import { RecruitmentPipelineModel } from "../model/recruitment-pipeline.model";
import type { RecruitmentScope } from "../utils/recruitment-scope";

export type PipelineStageInput = {
  id?: string;
  name: string;
  color: string;
  position?: number;
  isActive?: boolean;
  terminalOutcome?: "hired" | "rejected" | "withdrawn" | null;
};

const DEFAULT_STAGES: PipelineStageInput[] = [
  { id: "new", name: "New application", color: "#2563eb" },
  { id: "screening", name: "Screening", color: "#0891b2" },
  { id: "interview", name: "Interview", color: "#7c3aed" },
  { id: "offer", name: "Offer", color: "#ca8a04" },
  { id: "hired", name: "Hired", color: "#16a34a", terminalOutcome: "hired" },
  { id: "rejected", name: "Rejected", color: "#dc2626", terminalOutcome: "rejected" },
];

function normalizeStages(stages: PipelineStageInput[]) {
  const normalized = stages.map((stage, position) => ({
    id: String(stage.id || randomUUID()),
    name: String(stage.name || "").trim(),
    color: String(stage.color || "#64748b").trim(),
    position,
    isActive: stage.isActive !== false,
    terminalOutcome: stage.terminalOutcome || null,
  }));
  if (!normalized.length || normalized.some((stage) => !stage.name)) throw new Error("Pipeline requires named stages");
  if (new Set(normalized.map((stage) => stage.id)).size !== normalized.length) throw new Error("Pipeline stage IDs must be unique");
  return normalized;
}

export async function getOrCreatePipeline(scope: RecruitmentScope, actorId: string) {
  const existing = await RecruitmentPipelineModel.findOne({ ...scope, isDeleted: false }).lean();
  if (existing) return existing;
  return RecruitmentPipelineModel.create({
    ...scope,
    stages: normalizeStages(DEFAULT_STAGES),
    createdBy: actorId,
    updatedBy: actorId,
  });
}

export async function savePipeline(
  scope: RecruitmentScope,
  actorId: string,
  version: number,
  stages: PipelineStageInput[],
) {
  const current: any = await RecruitmentPipelineModel.findOne({ ...scope, isDeleted: false }).lean();
  if (!current) throw new Error("Pipeline not found");
  if (current.version !== version) throw new Error("Pipeline version conflict");
  const normalized = normalizeStages(stages);
  const nextById = new Map(normalized.map((stage) => [stage.id, stage]));
  for (const previous of current.stages || []) {
    const next = nextById.get(previous.id);
    if ((!next || !next.isActive) && await RecruitmentApplicantModel.exists({
      ...scope, stageId: previous.id, isDeleted: false,
    })) throw new Error("Pipeline stage is in use");
  }
  const updated = await RecruitmentPipelineModel.findOneAndUpdate(
    { ...scope, isDeleted: false, version },
    { $set: { stages: normalized, updatedBy: actorId }, $inc: { version: 1 } },
    { new: true, runValidators: true },
  );
  if (!updated) throw new Error("Pipeline version conflict");
  return updated;
}
