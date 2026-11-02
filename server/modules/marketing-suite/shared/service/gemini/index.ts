import { geminiChatService } from "./chat.service.ts";
import {
  AI_REPLY_COMMENT_MODEL,
  AI_REPLY_MESSAGE_MODEL,
  buildFaithfulVisualGuardrail,
  buildOpenRouterMessages,
  clampRegion,
  detectChatIntent,
  estimateAudioDuration,
  extractSourceBrief,
  fetchImageAsBase64,
  fetchWithRetry,
  formatHumanLikeChatReply,
  GEMINI_HEAVY_MODEL,
  GEMINI_TEXT_MODEL,
  generateText,
  getVideoDuration,
  MAX_POSTPROCESS_IMAGE_BYTES,
  normalizeIntentText,
  pcmToWav,
  readImageBuffer,
  safeParseJson,
  Type,
} from "./core";
import { geminiImageService } from "./image.service.ts";
import { geminiMarketingService } from "../../../campaign/service/gemini/marketing.service.ts";
import { geminiMediaHistoryService } from "./media-history.service.ts";
import { geminiPromptOptimizerService } from "./prompt-optimizer.service.ts";
import { geminiVideoService } from "./video.service.ts";

// Link circular references between marketing and media generators
geminiMarketingService.setMediaGenerators({
  imageService: geminiImageService,
});

export const geminiService = {
  // Legacy Telegram video commands; Campaign accepts uploaded videos only.
  generateVideo: geminiVideoService.generateVideo.bind(geminiVideoService),
  getOpenRouterVideoTaskStatus: geminiVideoService.getOpenRouterVideoTaskStatus.bind(geminiVideoService),
  pollOpenRouterVideoStatusBackground: geminiVideoService.pollOpenRouterVideoStatusBackground.bind(geminiVideoService),

  // Marketing Strategy & Generation
  conductWebResearch: geminiMarketingService.conductWebResearch.bind(geminiMarketingService),
  normalizeMarketingChannel: geminiMarketingService.normalizeMarketingChannel.bind(geminiMarketingService),
  sanitizeHashtags: geminiMarketingService.sanitizeHashtags.bind(geminiMarketingService),
  getMarketingSuggestions: geminiMarketingService.getMarketingSuggestions.bind(geminiMarketingService),
  analyzeMarketingPillars: geminiMarketingService.analyzeMarketingPillars.bind(geminiMarketingService),
  swapMarketingPillar: geminiMarketingService.swapMarketingPillar.bind(geminiMarketingService),
  generateMarketingIdeas: geminiMarketingService.generateMarketingIdeas.bind(geminiMarketingService),
  generateScheduledCampaign: geminiMarketingService.generateScheduledCampaign.bind(geminiMarketingService),
  generateCampaignCandidate: geminiMarketingService.generateCampaignCandidate.bind(geminiMarketingService),
  scoreCampaignCandidate: geminiMarketingService.scoreCampaignCandidate.bind(geminiMarketingService),
  developMarketingIdea: geminiMarketingService.developMarketingIdea.bind(geminiMarketingService),

  // Chat CRM & Auto-Reply
  chat: geminiChatService.chat.bind(geminiChatService),
  reviewReply: geminiChatService.reviewReply.bind(geminiChatService),
  chatComment: geminiChatService.chatComment.bind(geminiChatService),
  generateFollowUpMessage: geminiChatService.generateFollowUpMessage.bind(geminiChatService),
  convertDocToFAQ: geminiChatService.convertDocToFAQ.bind(geminiChatService),

  // Image & Inpainting
  generateImage: geminiImageService.generateImage.bind(geminiImageService),
  _generateImageWithOpenRouter: geminiImageService._generateImageWithOpenRouter.bind(geminiImageService),
  compositeEditedRegion: geminiImageService.compositeEditedRegion.bind(geminiImageService),
  cropImageToRegion: geminiImageService.cropImageToRegion.bind(geminiImageService),

  // Prompt Optimization & Document Extraction
  optimizeScript: geminiPromptOptimizerService.optimizeScript.bind(geminiPromptOptimizerService),
  optimizeImagePrompt: geminiPromptOptimizerService.optimizeImagePrompt.bind(geminiPromptOptimizerService),
  extractTextFromPdf: geminiPromptOptimizerService.extractTextFromPdf.bind(geminiPromptOptimizerService),

  // Media History
  getMediaHistory: geminiMediaHistoryService.getMediaHistory.bind(geminiMediaHistoryService),
  deleteMediaHistory: geminiMediaHistoryService.deleteMediaHistory.bind(geminiMediaHistoryService),
  saveGeneratedMediaRecord: geminiMediaHistoryService.saveGeneratedMediaRecord.bind(geminiMediaHistoryService),
};

export {
  AI_REPLY_COMMENT_MODEL,
  AI_REPLY_MESSAGE_MODEL,
  buildFaithfulVisualGuardrail,
  buildOpenRouterMessages,
  clampRegion,
  detectChatIntent,
  estimateAudioDuration,
  extractSourceBrief,
  fetchImageAsBase64,
  fetchWithRetry,
  formatHumanLikeChatReply,
  GEMINI_HEAVY_MODEL,
  GEMINI_TEXT_MODEL,
  geminiChatService,
  geminiImageService,
  geminiMarketingService,
  geminiMediaHistoryService,
  geminiPromptOptimizerService,
  geminiVideoService,
  generateText,
  getVideoDuration,
  MAX_POSTPROCESS_IMAGE_BYTES,
  normalizeIntentText,
  pcmToWav,
  readImageBuffer,
  safeParseJson,
  Type,
};

export * from "./types";
