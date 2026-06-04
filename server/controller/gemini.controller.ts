import { Request, Response } from "express";
import { geminiService } from "../service/gemini.service";

export const geminiController = {
  /**
   * POST /api/v1/gemini/chat
   */
  async chat(req: Request, res: Response) {
    try {
      const { message, history, aiConfig } = req.body;
      const result = await geminiService.chat(message, history, aiConfig);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.chat] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi kết nối Trợ lý AI Chatbot",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/gemini/marketing-suggestions
   */
  async getMarketingSuggestions(req: Request, res: Response) {
    try {
      const suggestions = await geminiService.getMarketingSuggestions();
      return res.status(200).json({ suggestions });
    } catch (error: any) {
      console.error("[geminiController.getMarketingSuggestions] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi tạo gợi ý chủ đề marketing",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/gemini/marketing-pillars
   */
  async analyzeMarketingPillars(req: Request, res: Response) {
    try {
      const { campaignTopic } = req.body;
      const result = await geminiService.analyzeMarketingPillars(campaignTopic);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.analyzeMarketingPillars] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi phân tích khung nội dung content pillars",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/gemini/marketing-ideas
   */
  async generateMarketingIdeas(req: Request, res: Response) {
    try {
      const { campaignTopic, selectedPillars } = req.body;
      const result = await geminiService.generateMarketingIdeas(campaignTopic, selectedPillars);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.generateMarketingIdeas] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi phát sinh ý tưởng chiến dịch AI",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/gemini/marketing-develop
   */
  async developMarketingIdea(req: Request, res: Response) {
    try {
      const { title, summary, suggestedContent, channels } = req.body;
      const result = await geminiService.developMarketingIdea(title, summary, suggestedContent, channels);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.developMarketingIdea] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi lập dàn ý và phát triển bài đăng chi tiết",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/gemini/generate-image
   */
  async generateImage(req: Request, res: Response) {
    try {
      const { prompt } = req.body;
      const result = await geminiService.generateImage(prompt);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.generateImage] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi sinh ảnh AI",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/gemini/generate-video
   */
  async generateVideo(req: Request, res: Response) {
    try {
      const { prompt, durationSeconds } = req.body;
      const result = await geminiService.generateVideo(prompt, durationSeconds);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[geminiController.generateVideo] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi sinh video AI",
        details: error.message,
      });
    }
  },
};
