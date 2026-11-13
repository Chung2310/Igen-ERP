import type { AuthenticatedRequest } from "../middleware/auth";
import { getEffectivePermissions } from "../middleware/auth";
import { getModuleStateForCompany, resolveModuleAccess } from "../middleware/require-module";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById, type AssistantOperation } from "./catalog";
import { AssistantWorkflowModel, ensureAssistantIndexes } from "./models";
import { AssistantError, validateWorkflow } from "./policy";
import type { AssistantWorkflow, AssistantWorkflowUpdate } from "../../src/shared/assistant-workflow";
export function actorScope(req: AuthenticatedRequest) {
  if (!req.user?.id || !req.user.companyCode || req.user.companyCode === "SYSTEM") throw new AssistantError("Tài khoản cần thuộc một doanh nghiệp để dùng trợ lý xử lý dữ liệu.", 403);
  return { userId: req.user.id, companyCode: req.user.companyCode };
}
export async function allowedOperations(req: AuthenticatedRequest): Promise<AssistantOperation[]> {
  const scope = actorScope(req);
  const [permissions, state] = await Promise.all([getEffectivePermissions(scope.userId, req.user!.role, scope.companyCode), getModuleStateForCompany(scope.companyCode)]);
  return ASSISTANT_OPERATIONS.filter(op => op.id !== "recruitment.pipeline.update"
    && (!op.roles || op.roles.includes(req.user!.role))
    && (op.id !== "employee.create" || ["admin", "superadmin"].includes(req.user!.role))
    && (permissions.has("*") || (op.permissionGroups || [op.permissions]).every(group => group.some(p => permissions.has(p))))
    && (op.modules || [op.module]).some(module => resolveModuleAccess(req.user, module, state.modules, state.exists, state.businessType)));
}
export async function assertOperation(req: AuthenticatedRequest, actionId: string) {
  const operation = (await allowedOperations(req)).find(op => op.id === actionId);
  if (!operation) throw new AssistantError("Bạn không có quyền dùng thao tác này hoặc phân hệ chưa được bật.", 403);
  return operation;
}
export async function listWorkflows(req: AuthenticatedRequest): Promise<AssistantWorkflow[]> {
  const scope = actorScope(req);
  await ensureAssistantIndexes();
  const operations = await allowedOperations(req);
  const savedIds = new Set((await AssistantWorkflowModel.find({ ...scope, actionId: { $in: operations.map(op => op.id) } }).select("actionId").lean()).map(row => row.actionId));
  const missing = operations.filter(op => !savedIds.has(op.id));
  if (missing.length) {
    try {
      await AssistantWorkflowModel.bulkWrite(missing.map(op => ({ updateOne: { filter: { ...scope, actionId: op.id }, update: { $setOnInsert: { ...scope, actionId: op.id, config: defaultWorkflow(op), version: 0 } }, upsert: true } })), { ordered: false });
    } catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  }
  const records = await AssistantWorkflowModel.find({ ...scope, actionId: { $in: operations.map(op => op.id) } }).lean();
  return operations.map(op => {
    const stored = records.find(record => record.actionId === op.id);
    const config = stored?.config as AssistantWorkflow | undefined;
    // Metadata and hard constraints always come from code, never from personal settings.
    if (!config) return defaultWorkflow(op);
    const baseWorkflow = defaultWorkflow(op);
    const savedFields = config.fields.filter(field => op.fields.some(base => base.key === field.key));
    const fields = [...savedFields, ...op.fields.filter(base => !savedFields.some(field => field.key === base.key))].map(field => {
      const base = op.fields.find(candidate => candidate.key === field.key)!;
      const savedDefaultValue = field.defaultValue;
      const defaultValue = base.reference ? undefined
        : savedDefaultValue === undefined ? base.defaultValue
          : field.type === "json" && typeof savedDefaultValue !== "string"
            ? JSON.stringify(savedDefaultValue)
            : savedDefaultValue;
      // A formerly locked API requirement is not a personal choice once the API relaxes it.
      const savedRequired = field.systemRequired && !base.systemRequired ? base.required : field.required;
      return { ...base, required: Boolean(base.systemRequired || savedRequired), defaultValue };
    });
    const savedInstructions = String(config.instructions || "").trim();
    const instructions = baseWorkflow.instructions && !savedInstructions.startsWith(baseWorkflow.instructions)
      ? [baseWorkflow.instructions, savedInstructions].filter(Boolean).join("\n")
      : savedInstructions;
    return { ...baseWorkflow, sourceText: config.sourceText, enabled: config.enabled, instructions, requireConfirmation: Boolean(op.confirmation || config.requireConfirmation), fields, version: stored!.version };
  });
}
export async function saveWorkflow(req: AuthenticatedRequest, actionId: string, update: AssistantWorkflowUpdate, reset = false) {
  const op = await assertOperation(req, actionId);
  await listWorkflows(req);
  const config = reset ? { ...defaultWorkflow(op), version: update.version + 1 } : validateWorkflow(op, update);
  const saved = await AssistantWorkflowModel.findOneAndUpdate({ ...actorScope(req), actionId, version: update.version }, { $set: { config }, $inc: { version: 1 } }, { returnDocument: "after" }).lean();
  if (!saved) throw new AssistantError("Workflow đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.", 409);
  return config;
}
export async function currentWorkflow(req: AuthenticatedRequest, actionId: string) {
  const workflow = (await listWorkflows(req)).find(w => w.actionId === actionId);
  if (!workflow?.enabled || !operationById(actionId)) throw new AssistantError("Chức năng này đã tắt hoặc bạn không còn quyền sử dụng.", 403);
  return workflow;
}
