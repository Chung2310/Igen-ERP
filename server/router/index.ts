import { Router } from "express";
import { geminiRouter } from "./gemini.router";
import { facebookPostRouter } from "./facebook-post.router";
import { tiktokRouter } from "./tiktok.router";
import { schedulerRouter } from "./scheduler.router";
import { mediaRouter } from "./media.router";

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

// Gắn kết router phụ của Facebook Post qua n8n
apiRouter.use("/facebook", facebookPostRouter);

// Gắn kết router phụ của TikTok
apiRouter.use("/tiktok", tiktokRouter);

// Gắn kết router phụ của Scheduler
apiRouter.use("/scheduler", schedulerRouter);

// Gắn kết router phụ của Media Cloudinary Relay
apiRouter.use("/media", mediaRouter);



