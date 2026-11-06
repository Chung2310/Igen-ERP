import type { AssistantSpeechVoice } from "./assistant-speech-voices";

export interface AssistantDataShape {
  type: string;
  required?: boolean;
  requiredWhen?: AssistantRequiredCondition;
  nullable?: boolean;
  keys?: Record<string, AssistantDataShape>;
  items?: AssistantDataShape;
  options?: (string | number | boolean)[];
  min?: number;
  exclusiveMin?: boolean;
  max?: number;
  integer?: boolean;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  open?: boolean;
  reference?: string;
  referenceValueKey?: string;
  referenceParentKey?: string;
  referenceParentOptional?: boolean;
  referenceContext?: Record<string, string | number | boolean>;
  label?: string;
}
export type AssistantValue = string | number | boolean;
export interface AssistantRequiredCondition {
  field: string;
  equals?: AssistantValue | AssistantValue[];
  present?: boolean;
}
export interface AssistantField {
  key: string;
  label: string;
  type: "text" | "email" | "phone" | "date" | "datetime" | "number" | "boolean" | "reference" | "json";
  max?: number;
  structure?: AssistantDataShape;
  source?: "path" | "query" | "body";
  apiKey?: string;
  systemRequired?: boolean;
  required?: boolean;
  defaultValue?: AssistantValue;
  options?: string[];
  min?: number;
  exclusiveMin?: boolean;
  integer?: boolean;
  pattern?: string;
  requiredWhen?: AssistantRequiredCondition;
  minItems?: number;
  reference?: string;
  referenceValueKey?: string;
  referenceParentKey?: string;
  referenceContext?: Record<string, string | number | boolean>;
}
export interface AssistantWorkflow {
  actionId: string;
  title: string;
  module: string;
  description: string;
  sourceText?: string;
  fields: AssistantField[];
  enabled: boolean;
  instructions: string;
  requireConfirmation: boolean;
  confirmationLocked: boolean;
  version: number;
}
export interface AssistantWorkflowUpdate {
  sourceText?: string;
  version: number;
  enabled: boolean;
  instructions: string;
  requireConfirmation: boolean;
  fields: { key: string; required: boolean; defaultValue?: AssistantValue }[];
}
export interface AssistantReferenceSelection {
  key: string;
  label: string;
  required: boolean;
  multiple: boolean;
  options: { label: string; value: string }[];
}
export type AssistantTrainingLessonType = "youtube" | "document" | "other" | "text" | "video";
export interface AssistantTrainingLessonAnswer {
  title: string;
  type: AssistantTrainingLessonType;
  url?: string;
  content?: string;
  fileName?: string;
  uploadToken?: string;
}
export interface AssistantTrainingQuizAnswer {
  question: string;
  options: string[];
  correctOptionIndex: number;
}
export interface AssistantTrainingContentForm {
  lessons: AssistantTrainingLessonAnswer[];
  quizzes: AssistantTrainingQuizAnswer[];
}
export interface AssistantReply {
  reply: string;
  status: "collecting" | "confirmation" | "completed" | "cancelled" | "unsupported" | "failed" | "processing" | "uncertain";
  action?: { requiresPassword?: boolean; id: string; title: string; values: { label: string; value: AssistantValue; defaulted?: boolean }[] };
  referenceSelections?: AssistantReferenceSelection[];
  trainingContentForm?: AssistantTrainingContentForm;
  link?: string;
}

export interface AssistantTableAttachment {
  fileName: string;
  headers: string[];
  rows: Array<Record<string, string>>;
}

export interface AssistantSettings { version: number; windowMode: "window" | "fullscreen"; enterToSend: boolean; showSuggestions: boolean; instructions: string; responseRules: string; alwaysConfirm: boolean; speakReplies: boolean; speechVoice: AssistantSpeechVoice; wakeWordEnabled: boolean; memoryEnabled: boolean; autoMemoryEnabled: boolean; }
export const defaultAssistantSettings: AssistantSettings = { version: 0, windowMode: "window", enterToSend: true, showSuggestions: true, instructions: "", responseRules: "Trả lời bằng tiếng Việt tự nhiên, thân thiện và ngắn gọn; xưng mình–bạn. Giữ mạch hội thoại, tránh câu mẫu máy móc và không hiển thị JSON thô. Nếu thiếu thông tin, hỏi rõ từng ý cần bổ sung. Chỉ báo thao tác thành công khi hệ thống xác nhận đã hoàn tất; nếu không tìm thấy hoặc chưa hỗ trợ, giải thích nhẹ nhàng và gợi ý bước tiếp theo.", alwaysConfirm: false, speakReplies: false, speechVoice: "sarah", wakeWordEnabled: false, memoryEnabled: true, autoMemoryEnabled: true };

/** Human-readable source for existing personal workflows and seeded templates. */
export function workflowToText(workflow: AssistantWorkflow): string {
  return [
    workflow.enabled ? `Cho phép trợ lý dùng workflow: ${workflow.title}.` : `Tắt workflow: ${workflow.title}.`,
    "Kiểm tra thông tin theo thứ tự:",
    ...workflow.fields.map((field, index) => {
      const condition = field.requiredWhen;
      const conditionField = condition && workflow.fields.find(candidate => candidate.key === condition.field);
      const conditionText = condition ? condition.present
        ? ` Bắt buộc khi đã nhập ${conditionField?.label || condition.field}.`
        : ` Bắt buộc khi ${conditionField?.label || condition.field} là ${JSON.stringify(condition.equals)}.` : "";
      return `${index + 1}. ${field.label}: ${field.systemRequired || field.required ? "bắt buộc" : "không bắt buộc"}.${conditionText}${field.defaultValue !== undefined ? ` Nếu thiếu, dùng mặc định ${JSON.stringify(field.defaultValue)}.` : " Không tự điền khi thiếu."}`;
    }),
    "Nếu thiếu thông tin bắt buộc chưa có mặc định, hỏi người dùng bổ sung.",
    workflow.requireConfirmation ? "Khi đủ thông tin, yêu cầu xác nhận trước khi thực hiện." : "Khi đủ thông tin, thực hiện theo quyền của người dùng.",
    ...(workflow.instructions ? [`Hướng dẫn diễn giải: ${workflow.instructions}`] : []),
  ].join("\n");
}
