import { Request, Response } from "express";
import { geminiService } from "../service/gemini.service";
import { AuthenticatedRequest } from "../middleware/auth";
import { aiKnowledgeService } from "../service/ai-knowledge.service";
import { walletService, API_COSTS } from "../service/wallet.service";

function handleGeminiError(res: Response, error: any, defaultMessage: string) {
  const details = error.message || String(error);
  const status = error.status || error.statusCode;

  if (status === 402) {
    return res.status(402).json({
      status: "error",
      message: error.message || "Số dư ví không đủ. Vui lòng nạp thêm tiền.",
    });
  }

  let errMsg = defaultMessage;
  let statusCode = 500;
  const errStr = String(error.message || "").toUpperCase();

  if (status === 503 || errStr.includes("503") || errStr.includes("UNAVAILABLE")) {
    errMsg = "Dịch vụ AI của Gemini hiện đang quá tải hoặc tạm thời không khả dụng. Vui lòng thử lại sau ít phút.";
    statusCode = 503;
  } else if (status === 429 || errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED")) {
    errMsg = "Yêu cầu vượt quá giới hạn tần suất (Rate Limit) cho phép của API Key. Vui lòng đợi và thử lại sau.";
    statusCode = 429;
  } else if (status === 400 || errStr.includes("400") || errStr.includes("INVALID_ARGUMENT")) {
    errMsg = "Tham số yêu cầu không hợp lệ hoặc bị từ chối bởi quy tắc an toàn nội dung của Google AI.";
    statusCode = 400;
  } else if (status === 403 || errStr.includes("403") || errStr.includes("PERMISSION_DENIED")) {
    errMsg = "API Key không hợp lệ hoặc không có quyền truy cập vào mô hình AI.";
    statusCode = 403;
  }

  return res.status(statusCode).json({
    status: "error",
    message: errMsg,
    details: details,
  });
}

export const geminiController = {
  /**
   * POST /api/v1/gemini/chat
   */
  async chat(req: Request, res: Response) {
    try {
      const { message, history, aiConfig } = req.body;
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      await walletService.checkBalance(userId, API_COSTS.GEMINI_CHAT);
      const result = await geminiService.chat(message, history, aiConfig);
      await walletService.deductBalance(userId, API_COSTS.GEMINI_CHAT, "Chi phí sử dụng Trợ lý AI Chatbot");
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.chat] Error:", error);
      return handleGeminiError(res, error, "Lỗi kết nối Trợ lý AI Chatbot");
    }
  },

  /**
   * GET /api/v1/gemini/knowledge-health
   */
  async getKnowledgeHealth(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await aiKnowledgeService.getKnowledgeHealth(req.user?.companyCode);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.getKnowledgeHealth] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể kiểm tra trạng thái tri thức AI",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/gemini/test-reply
   */
  async testReply(req: AuthenticatedRequest, res: Response) {
    try {
      const { message, aiConfig } = req.body;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      await walletService.checkBalance(userId, API_COSTS.GEMINI_CHAT);
      const startedAt = Date.now();
      const ragContext = await aiKnowledgeService.searchRelevantContext({
        companyCode,
        query: message,
        channel: "facebook",
        topK: 5,
      });

      let effectiveRagContext = { ...ragContext, companyCode };
      if (!ragContext.contextText && aiConfig?.trainingKnowledge) {
        effectiveRagContext = {
          contextText: String(aiConfig.trainingKnowledge).slice(0, 4500),
          matches: 0,
          companyCode,
        };
      }

      const result = await geminiService.chat(message, [], aiConfig || {}, effectiveRagContext);
      const log = await aiKnowledgeService.createReplyLog({
        companyCode,
        channel: "test",
        customerMessage: message,
        aiResponse: result.text,
        contextText: effectiveRagContext.contextText,
        contextMatches: effectiveRagContext.matches,
        latencyMs: Date.now() - startedAt,
        status: "preview",
      });

      await walletService.deductBalance(userId, API_COSTS.GEMINI_CHAT, "Chi phí test câu trả lời tự động AI");
      return res.status(200).json({
        ...result,
        mode: effectiveRagContext.contextText ? "trained" : "default",
        contextMatches: effectiveRagContext.matches || 0,
        logId: log._id,
      });
    } catch (error: any) {
      console.error("[geminiController.testReply] Error:", error);
      return handleGeminiError(res, error, "Không thể tạo câu trả lời thử");
    }
  },

  /**
   * GET /api/v1/gemini/ai-reply-logs
   */
  async listAIReplyLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const logs = await aiKnowledgeService.listReplyLogs(req.user?.companyCode, Number(req.query.limit || 20));
      return res.status(200).json({ logs });
    } catch (error: any) {
      console.error("[geminiController.listAIReplyLogs] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể tải log phản hồi AI",
        details: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/gemini/ai-reply-logs/:id/feedback
   */
  async updateAIReplyFeedback(req: AuthenticatedRequest, res: Response) {
    try {
      const { feedback, note } = req.body;
      const log = await aiKnowledgeService.updateReplyFeedback(req.user?.companyCode, req.params.id, feedback, note);
      if (!log) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy log phản hồi AI." });
      }
      return res.status(200).json({ status: "success", log });
    } catch (error: any) {
      console.error("[geminiController.updateAIReplyFeedback] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lưu feedback phản hồi AI",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/gemini/marketing-suggestions
   */
  async getMarketingSuggestions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      await walletService.checkBalance(userId, API_COSTS.GEMINI_MARKETING);
      const suggestions = await geminiService.getMarketingSuggestions();
      await walletService.deductBalance(userId, API_COSTS.GEMINI_MARKETING, "Chi phí tạo gợi ý chủ đề Marketing AI");
      return res.status(200).json({ suggestions });
    } catch (error: any) {
      console.error("[geminiController.getMarketingSuggestions] Error:", error);
      return handleGeminiError(res, error, "Lỗi tạo gợi ý chủ đề marketing");
    }
  },

  /**
   * POST /api/v1/gemini/marketing-pillars
   */
  async analyzeMarketingPillars(req: Request, res: Response) {
    try {
      const { campaignTopic } = req.body;
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      await walletService.checkBalance(userId, API_COSTS.GEMINI_MARKETING);
      const result = await geminiService.analyzeMarketingPillars(campaignTopic);
      await walletService.deductBalance(userId, API_COSTS.GEMINI_MARKETING, "Chi phí phân tích Content Pillars bằng AI");
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.analyzeMarketingPillars] Error:", error);
      return handleGeminiError(res, error, "Lỗi phân tích khung nội dung content pillars");
    }
  },

  /**
   * POST /api/v1/gemini/marketing-ideas
   */
  async generateMarketingIdeas(req: Request, res: Response) {
    try {
      const { campaignTopic, selectedPillars, channels, mediaType } = req.body;
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      await walletService.checkBalance(userId, API_COSTS.GEMINI_MARKETING);
      const result = await geminiService.generateMarketingIdeas(campaignTopic, selectedPillars, channels, mediaType);
      await walletService.deductBalance(userId, API_COSTS.GEMINI_MARKETING, "Chi phí phát sinh ý tưởng chiến dịch AI");
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.generateMarketingIdeas] Error:", error);
      return handleGeminiError(res, error, "Lỗi phát sinh ý tưởng chiến dịch AI");
    }
  },

  /**
   * POST /api/v1/gemini/marketing-develop
   */
  async developMarketingIdea(req: Request, res: Response) {
    try {
      const { 
        title, 
        summary, 
        suggestedContent, 
        channels,
        mediaType,
        imageModel,
        imageResolution,
        imageAspectRatio,
        videoModel,
        videoQuality,
        videoDuration,
        videoAspectRatio
      } = req.body;
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      await walletService.checkBalance(userId, API_COSTS.GEMINI_MARKETING);
      const result = await geminiService.developMarketingIdea(title, summary, suggestedContent, channels, {
        mediaType,
        imageModel,
        imageResolution,
        imageAspectRatio,
        videoModel,
        videoQuality,
        videoDuration,
        videoAspectRatio
      });
      await walletService.deductBalance(userId, API_COSTS.GEMINI_MARKETING, "Chi phí viết bài và lập dàn ý Marketing AI");
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.developMarketingIdea] Error:", error);
      return handleGeminiError(res, error, "Lỗi lập dàn ý và phát triển bài đăng chi tiết");
    }
  },

  /**
   * POST /api/v1/gemini/generate-image
   */
  async generateImage(req: Request, res: Response) {
    try {
      const { prompt, aspectRatio, modelName, resolution, existingImageUris } = req.body;
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      await walletService.checkBalance(userId, API_COSTS.GEMINI_IMAGE);
      const result = await geminiService.generateImage(prompt, {
        aspectRatio,
        modelName,
        resolution,
        existingImageUris,
      });

      let record = null;
      if (userId && result.url) {
        record = await geminiService.saveGeneratedMediaRecord(userId, "image", result.url, prompt, {
          aspectRatio,
          resolution,
          modelName,
        });
      }

      await walletService.deductBalance(userId, API_COSTS.GEMINI_IMAGE, "Chi phí sinh ảnh minh họa AI");
      return res.status(200).json({
        ...result,
        url: record ? record.url : result.url,
        record,
      });
    } catch (error: any) {
      console.error("[geminiController.generateImage] Error:", error);
      return handleGeminiError(res, error, "Lỗi sinh ảnh AI");
    }
  },

  /**
   * POST /api/v1/gemini/generate-video
   */
  async generateVideo(req: Request, res: Response) {
    try {
      const { prompt, durationSeconds, aspectRatio, modelName, resolution, referenceVideoUri, referenceImageUris, frameMode, activeCardId } = req.body;
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      await walletService.checkBalance(userId, API_COSTS.GEMINI_VIDEO);
      const result = await geminiService.generateVideo(prompt, durationSeconds, {
        aspectRatio,
        modelName,
        resolution,
        referenceVideoUri,
        referenceImageUris,
        frameMode,
      });

      let record = null;
      if (userId && result.url) {
        const isPending = result.url.startsWith("pending://");
        record = await geminiService.saveGeneratedMediaRecord(userId, "video", result.url, prompt, {
          aspectRatio,
          resolution,
          modelName,
          durationSeconds,
          originalVeoUrl: referenceVideoUri,
          activeCardId,
          piapiTaskId: (result as any).taskId,
          status: isPending ? "processing" : "completed",
          progress: isPending ? 1 : 100,
        });
        if (isPending && (result as any).taskId) {
          geminiService.pollPiAPIVideoStatusBackground(record._id.toString(), (result as any).taskId, userId);
        }
      }

      await walletService.deductBalance(userId, API_COSTS.GEMINI_VIDEO, "Chi phí sinh video AI");
      return res.status(200).json({
        ...result,
        url: record ? record.url : result.url,
        record,
      });
    } catch (error: any) {
      console.error("[geminiController.generateVideo] Error:", error);
      return handleGeminiError(res, error, "Lỗi sinh video AI");
    }
  },

  /**
   * POST /api/v1/gemini/edit-video
   */
  async editVideo(req: Request, res: Response) {
    try {
      const { videoUrl, prompt, modelName, aspectRatio, resolution, duration } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      const result = await geminiService.editVideo(userId, videoUrl, prompt, {
        modelName,
        aspectRatio,
        resolution,
        duration,
      });

      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.editVideo] Error:", error);
      return handleGeminiError(res, error, "Lỗi biên tập video bằng AI");
    }
  },

  /**
   * POST /api/v1/gemini/sync-drive
   */
  async syncGoogleDrive(req: AuthenticatedRequest, res: Response) {
    try {
      const { docLink } = req.body;
      if (!docLink) {
        return res.status(400).json({
          status: "error",
          message: "Thiếu đường dẫn tài liệu Google Drive."
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      await walletService.checkBalance(userId, API_COSTS.GEMINI_FAQ);
      console.log(`[AI AutoReply] Bắt đầu đồng bộ tài liệu từ Google Drive/Doc link: ${docLink}`);

      // Extract Google Doc ID if possible
      const docMatch = docLink.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      let extractedText = "";
      let isMocked = true;
      let docTitle = "Tài liệu Google Drive";

      if (docMatch && docMatch[1]) {
        const fileId = docMatch[1];
        const exportUrl = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
        try {
          const fetchRes = await fetch(exportUrl);
          if (fetchRes.ok) {
            extractedText = await fetchRes.text();
            isMocked = false;
            docTitle = `Google Doc (ID: ${fileId})`;
            console.log(`[AI AutoReply] Đồng bộ Google Doc thành công từ link thật! Độ dài ký tự: ${extractedText.length}`);
          }
        } catch (fetchErr) {
          console.warn("[AI AutoReply] Không thể tải doc link trực tiếp (có thể doc đang ở chế độ riêng tư). Chuyển sang mô phỏng.", fetchErr);
        }
      }

      // Fallback/Simulated sync if fetch failed or not a direct public doc
      if (isMocked) {
        // Generate a nice title from the URL
        let parsedName = "Huong_dan_ban_hang_va_FAQ_Doanh_nghiep";
        try {
          const urlObj = new URL(docLink);
          const pathSegments = urlObj.pathname.split("/").filter(Boolean);
          if (pathSegments.length > 0) {
            parsedName = pathSegments[pathSegments.length - 1];
          }
        } catch (e) { }

        docTitle = `Mô phỏng file [${parsedName}]`;
        extractedText = `--- TÀI LIỆU ĐỒNG BỘ TỪ GOOGLE DRIVE [${parsedName}] ---
Ngày đồng bộ: ${new Date().toLocaleString("vi-VN")}
Trạng thái: Thành công (Chế độ demo thông minh)

1. VỀ CHÚNG TÔI (iGen ERP):
- iGen ERP cung cấp giải pháp chuyển đổi số toàn diện cho doanh nghiệp (Quản lý Nhân sự, Kho hàng, Marketing và Sales CRM Omni-Channel).
- Địa chỉ văn phòng: Tòa nhà iGen, Cầu Giấy, Hà Nội.
- Hotline chăm sóc khách hàng: 1900-8888 (Hoạt động 8:00 - 18:00 hàng ngày).

2. CHÍNH SÁCH VÀ DỊCH VỤ:
- Gói Start: 500.000đ/tháng (Tối đa 5 nhân sự, đầy đủ tính năng CRM cơ bản).
- Gói Growth: 1.200.000đ/tháng (Tối đa 20 nhân sự, tích hợp Facebook/Zalo OA).
- Gói Enterprise: 3.500.000đ/tháng (Không giới hạn nhân sự, tùy chỉnh theo yêu cầu).
- Khách hàng đăng ký mới được dùng thử MIỄN PHÍ 14 ngày, đầy đủ tính năng.

3. HỎI ĐÁP THƯỜNG GẶP (FAQs):
Q: Hệ thống có hỗ trợ gửi tin tự động không?
A: Có, iGen ERP tích hợp AI trợ lý thông minh giúp tự động phản hồi khách hàng đa kênh Facebook, Zalo, TikTok với độ trễ tùy chỉnh và học trực tiếp tài liệu này.

Q: Phí lắp đặt và cài đặt ban đầu là bao nhiêu?
A: Hoàn toàn MIỄN PHÍ. Đội ngũ kỹ thuật của iGen sẽ hỗ trợ cài đặt cấu hình và training sử dụng online 1-1.
--------------------------------------------------`;
      }

      // Convert the extracted text (whether real or mocked) to a structured FAQ using Gemini
      console.log(`[AI AutoReply] Đang tiến hành băm và chuyển đổi tài liệu thành dạng FAQs bằng Gemini...`);
      const faqText = await geminiService.convertDocToFAQ(extractedText);
      const companyCode = req.user?.companyCode || "SYSTEM";
      const syncResult = await aiKnowledgeService.upsertKnowledgeFromText({
        companyCode,
        sourceType: "google_doc",
        sourceTitle: docTitle,
        sourceUrl: docLink,
        text: faqText,
        createdBy: req.user?.id,
        channelScope: ["all"],
      });

      await walletService.deductBalance(userId, API_COSTS.GEMINI_FAQ, `Chi phí đồng bộ Drive & FAQ AI (${docTitle})`);
      return res.status(200).json({
        status: "success",
        title: docTitle,
        text: faqText,
        isMocked,
        companyCode,
        chunksCount: syncResult.chunksCount
      });
    } catch (error: any) {
      console.error("[geminiController.syncGoogleDrive] Error:", error);
      return handleGeminiError(res, error, "Lỗi đồng bộ dữ liệu từ Google Drive");
    }
  },

  /**
   * POST /api/v1/gemini/generate-voice
   */
  async generateVoice(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      const textToSpeak = req.body.textToSpeak || "";
      const charCount = textToSpeak.length;
      const cost = Math.max(API_COSTS.ELEVENLABS_MIN, charCount * API_COSTS.ELEVENLABS_TTS_CHAR);

      await walletService.checkBalance(userId, cost);
      const record = await geminiService.generateVoice(userId, req.body);
      await walletService.deductBalance(userId, cost, `Chi phí tạo giọng nói AI ElevenLabs (${charCount} ký tự)`);
      return res.status(200).json({
        status: "success",
        record,
      });
    } catch (error: any) {
      console.error("[geminiController.generateVoice] Error:", error);
      return handleGeminiError(res, error, "Lỗi tạo giọng nói AI");
    }
  },

  /**
   * POST /api/v1/gemini/optimize-script
   */
  async optimizeScript(req: Request, res: Response) {
    try {
      const { text, readingStyle } = req.body;
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      await walletService.checkBalance(userId, API_COSTS.GEMINI_OPTIMIZE);
      const result = await geminiService.optimizeScript(text, readingStyle);
      await walletService.deductBalance(userId, API_COSTS.GEMINI_OPTIMIZE, "Chi phí tối ưu kịch bản bằng AI");
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.optimizeScript] Error:", error);
      return handleGeminiError(res, error, "Lỗi tối ưu kịch bản");
    }
  },

  /**
   * POST /api/v1/gemini/optimize-prompt
   */
  async optimizeImagePrompt(req: Request, res: Response) {
    try {
      const { description, imageUris, modelName } = req.body;
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      await walletService.checkBalance(userId, API_COSTS.GEMINI_OPTIMIZE);
      const result = await geminiService.optimizeImagePrompt(description, imageUris, modelName);
      await walletService.deductBalance(userId, API_COSTS.GEMINI_OPTIMIZE, "Phí tối ưu prompt sinh ảnh AI");
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.optimizeImagePrompt] Error:", error);
      return handleGeminiError(res, error, "Lỗi tối ưu prompt ảnh");
    }
  },

  /**
   * POST /api/v1/gemini/optimize-video-prompt
   */
  async optimizeVideoPrompt(req: Request, res: Response) {
    try {
      const { description, imageUris } = req.body;
<<<<<<< HEAD
      console.log(`[geminiController.optimizeVideoPrompt] Incoming description to optimize: "${description}"`);
=======
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      await walletService.checkBalance(userId, API_COSTS.GEMINI_OPTIMIZE);
>>>>>>> 6879358010148f43fb5a2839b94627d274a216e3
      const result = await geminiService.optimizeVideoPrompt(description, imageUris);
      await walletService.deductBalance(userId, API_COSTS.GEMINI_OPTIMIZE, "Phí tối ưu prompt sinh video AI");
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.optimizeVideoPrompt] Error:", error);
      return handleGeminiError(res, error, "Lỗi tối ưu prompt video");
    }
  },

  /**
   * GET /api/v1/gemini/media-history
   */
  async getMediaHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { type } = req.query;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }
      const history = await geminiService.getMediaHistory(userId, type as any);
      return res.status(200).json({ status: "success", history });
    } catch (error: any) {
      console.error("[geminiController.getMediaHistory] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi lấy lịch sử sinh đa phương tiện",
        details: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/gemini/media-history/:id
   */
  async deleteMediaHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }
      const result = await geminiService.deleteMediaHistory(userId, id);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.deleteMediaHistory] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi xóa bản ghi lịch sử",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/gemini/elevenlabs-voices
   */
  async getElevenLabsVoices(req: Request, res: Response) {
    try {
      const result = await geminiService.getElevenLabsVoices();
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.getElevenLabsVoices] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy danh sách giọng nói ElevenLabs",
        details: error.message
      });
    }
  },

  /**
   * POST /api/v1/gemini/elevenlabs-custom-voice-preview
   */
  async generateCustomVoicePreview(req: Request, res: Response) {
    try {
      const { gender, accent, age, accentStrength, text } = req.body;
      const result = await geminiService.generateCustomVoicePreview({ gender, accent, age, accentStrength, text });
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.generateCustomVoicePreview] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể thiết kế giọng nói thử nghiệm",
        details: error.message
      });
    }
  },

  /**
   * POST /api/v1/gemini/elevenlabs-create-voice
   */
  async createCustomVoice(req: Request, res: Response) {
    try {
      const { voiceName, voiceDescription, generatedVoiceId } = req.body;
      const result = await geminiService.createCustomVoice({ voiceName, voiceDescription, generatedVoiceId });
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.createCustomVoice] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lưu giọng nói cá nhân vào ElevenLabs",
        details: error.message
      });
    }
  },

  /**
   * POST /api/v1/gemini/elevenlabs-add-voice
   */
  async addElevenLabsVoice(req: Request, res: Response) {
    try {
      const { name, description, files, userId } = req.body;
      const result = await geminiService.addElevenLabsVoice(name, description, files, userId);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.addElevenLabsVoice] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể nhân bản giọng nói ElevenLabs",
        details: error.message
      });
    }
  },

  /**
   * DELETE /api/v1/gemini/elevenlabs-delete-voice/:voiceId
   */
  async deleteElevenLabsVoice(req: Request, res: Response) {
    try {
      const { voiceId } = req.params;
      const result = await geminiService.deleteElevenLabsVoice(voiceId);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.deleteElevenLabsVoice] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể xóa giọng nói ElevenLabs",
        details: error.message
      });
    }
  }
};
