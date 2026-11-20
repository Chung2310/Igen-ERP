import { logger } from "../config/logger";
﻿import type { ChatbotMessage } from "../service/chatbot.service";
import type { AssistantAccessContext, AssistantEvidence, AssistantResponse } from "./assistant.types";
import { planAssistantSources, resolveRetrievalQuestion } from "./assistant-planner";
import { resolveConversationReply } from "./assistant-conversation";
import { hasKnowledgePermission } from "./knowledge/knowledge-access";
import type { KnowledgeSearchInput } from "./knowledge/knowledge-retrieval.service";
export interface CompositionResult {
  clarificationQuestion?: string;
  reply: string;
  usedEvidenceIds: string[];
  sufficient: boolean;
  partial?: boolean;
  usage?: { promptTokens?: number; completionTokens?: number; costUSD?: number; model?: string };
}
interface ComposeInput {
  question: string;
  history: ChatbotMessage[];
  evidence: AssistantEvidence[];
}
interface Dependencies {
  analyzeWorkbook?(context: AssistantAccessContext, question: string): Promise<AssistantResponse | undefined>;
  searchKnowledge(input: KnowledgeSearchInput): Promise<AssistantEvidence[]>;
  executeTool(name: string, args: unknown, context: AssistantAccessContext): Promise<AssistantEvidence[]>;
  compose(input: ComposeInput): Promise<CompositionResult>;
}
const EMPTY_REPLY = "Không tìm thấy dữ liệu phù hợp trong phạm vi bạn được phép truy cập.";
export function validateComposition(value: unknown, evidence: AssistantEvidence[]): CompositionResult {
  const result = value as CompositionResult;
  const known = new Set(evidence.map((item) => item.id));
  if (
    result &&
    typeof result.clarificationQuestion === "string" &&
    result.clarificationQuestion.trim().endsWith("?") &&
    result.clarificationQuestion.length <= 300 &&
    result.reply === result.clarificationQuestion &&
    result.sufficient === false &&
    Array.isArray(result.usedEvidenceIds) &&
    result.usedEvidenceIds.length === 0
  ) {
    return {
      reply: result.clarificationQuestion.trim(),
      clarificationQuestion: result.clarificationQuestion.trim(),
      sufficient: false,
      usedEvidenceIds: [],
    };
  }
  if (
    !result ||
    typeof result.reply !== "string" ||
    !result.reply.trim() ||
    result.reply.length > 12000 ||
    result.sufficient !== true ||
    !Array.isArray(result.usedEvidenceIds) ||
    !result.usedEvidenceIds.length ||
    result.usedEvidenceIds.some((id) => typeof id !== "string" || !known.has(id))
  ) {
    return {
      reply:
        "Chưa đủ bằng chứng để trả lời chính xác câu hỏi này. Hãy bổ sung tài liệu hoặc làm rõ phạm vi cần tra cứu.",
      usedEvidenceIds: [],
      sufficient: false,
    };
  }
  return {
    reply: result.reply.trim(),
    usedEvidenceIds: [...new Set(result.usedEvidenceIds)],
    sufficient: true,
    ...(result.partial ? { partial: true } : {}),
  };
}
function logStage(stage: string, startedAt: number, evidenceCount?: number): void {
  logger.info(`[AssistantTiming] stage=${stage} elapsedMs=${Date.now() - startedAt} evidence=${evidenceCount ?? 0}`);
}
export function createAssistantOrchestrator(dependencies: Dependencies) {
  return {
    async answer(context: AssistantAccessContext, messages: ChatbotMessage[]): Promise<AssistantResponse> {
      const history: ChatbotMessage[] = [];
      let historyCharacters = 0;
      for (const message of messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .slice(-12)
        .reverse()) {
        if (historyCharacters + message.content.length > 16000) break;
        history.unshift(message);
        historyCharacters += message.content.length;
      }
      const userQuestions = history
        .filter((message) => message.role === "user")
        .map((message) => message.content.trim());
      const question = userQuestions.at(-1) || "";
      const conversationReply = resolveConversationReply(question);
      if (conversationReply) {
        return {
          reply: conversationReply,
          citations: [],
          status: "answered",
          suggestions: [],
          queriedAt: new Date().toISOString(),
          diagnostics: { retrievedIds: [], scores: [], retrievalMs: 0, composeMs: 0 },
        };
      }
      const retrievalQuestion = resolveRetrievalQuestion(
        question,
        userQuestions.slice(0, -1),
        history.filter((message) => message.role === "assistant").at(-1)?.content,
      );
      const workbookResult = await dependencies.analyzeWorkbook?.(context, retrievalQuestion);
      if (workbookResult) return workbookResult;
      const plan = planAssistantSources(retrievalQuestion);
      const evidence: AssistantEvidence[] = [];
      const retrievalStarted = Date.now();
      const work: Promise<void>[] = [];
      if (plan.knowledge && hasKnowledgePermission(context, "read"))
        work.push(
          (async () => {
            const started = Date.now();
            const found = await dependencies.searchKnowledge({ context, query: retrievalQuestion });
            evidence.push(...found);
            logStage("knowledge", started, found.length);
          })(),
        );
      for (const tool of plan.tools)
        work.push(
          (async () => {
            const started = Date.now();
            try {
              const found = await dependencies.executeTool(tool, {}, context);
              evidence.push(...found);
              logStage(`tool:${tool}`, started, found.length);
            } catch (error) {
              if (!(error instanceof Error) || !error.message.includes("không có quyền")) throw error;
              logStage(`tool:${tool}`, started, 0);
            }
          })(),
        );
      await Promise.all(work);
      evidence.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.id.localeCompare(b.id));
      const queriedAt = new Date().toISOString();
      const diagnostics = {
        retrievedIds: evidence.map((item) => item.id),
        scores: evidence.map((item) => item.score ?? 0),
        retrievalMs: Date.now() - retrievalStarted,
        composeMs: 0,
      };
      if (!evidence.length)
        return {
          reply: EMPTY_REPLY,
          citations: [],
          status: "not_found",
          suggestions: [
            "Hãy nêu rõ chính sách hoặc tài liệu cần tra cứu.",
            "Các công cụ thống kê hiện chỉ hỗ trợ tổng số trong phạm vi được phép.",
          ],
          queriedAt,
          diagnostics,
        };
      const started = Date.now();
      if (
        /\b(tong|dem|trung binh|sum|count|average)\b/.test(
          retrievalQuestion
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[đĐ]/g, "d")
            .toLowerCase(),
        ) &&
        evidence.some((item) => item.sourceType === "knowledge" && /\.(xlsx?|csv)$/i.test(item.title))
      ) {
        return {
          reply:
            "Cần tính trên toàn bộ bảng thay vì các đoạn trích. Hãy nêu rõ tên tệp, sheet và cột cần tính; nếu tệp cũ chưa có dữ liệu bảng, hãy lập chỉ mục lại.",
          citations: [],
          status: "insufficient_evidence",
          suggestions: [],
          queriedAt,
          diagnostics,
        };
      }
      const composed = await dependencies.compose({ question, history, evidence });
      const result = validateComposition(composed, evidence);
      logStage("compose", started, evidence.length);
      const used = new Set(result.usedEvidenceIds);
      const extractionWarnings = [
        ...new Set(evidence.filter((item) => used.has(item.id)).flatMap((item) => item.extractionWarnings || [])),
      ];
      const citations = Array.from(
        new Map(evidence.filter((item) => used.has(item.id)).map((item) => [item.citation.id, item.citation])).values(),
      );
      return {
        reply:
          result.reply +
          (extractionWarnings.length ? `\nLưu ý: tài liệu nguồn chưa đọc đầy đủ. ${extractionWarnings.join(" ")}` : ""),
        citations,
        status: result.sufficient
          ? result.partial || extractionWarnings.length
            ? "partial"
            : "answered"
          : "insufficient_evidence",
        suggestions: [],
        queriedAt,
        diagnostics: { ...diagnostics, composeMs: Date.now() - started, ...composed.usage },
      };
    },
  };
}
