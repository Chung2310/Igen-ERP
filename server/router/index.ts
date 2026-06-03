import { Router } from "express";
import { geminiRouter } from "./gemini.router";

export const apiRouter = Router();

/**
 * GET /api/v1/health
 * Health Check API để giám sát trạng thái của hệ thống
 */
apiRouter.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      server: "up",
      database: "online (connected via client-side firestore)",
    },
  });
});

// Gắn kết router phụ của Gemini
apiRouter.use("/gemini", geminiRouter);
