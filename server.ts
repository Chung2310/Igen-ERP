import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { apiRouter } from "./server/router";
import { swaggerRouter } from "./server/swagger";

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // 1. Cấu hình CORS bảo mật sử dụng allowedOrigins từ biến môi trường LINK_COR
  const allowedOrigins = process.env.LINK_COR
    ? process.env.LINK_COR.split(",")
    : ["http://localhost:5173", "http://localhost:3000"];

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // 2. Tài liệu API Swagger tại đường dẫn /api-docs
  app.use("/api-docs", swaggerRouter);

  // Đảm bảo thư mục uploads tồn tại
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Phục vụ tĩnh thư mục uploads
  app.use("/uploads", express.static(uploadsDir));

  // 3. Đăng ký Versioned API Router với tiền tố /api/v1/
  app.use("/api/v1", apiRouter);

  // 4. Cấu hình phục vụ tệp tĩnh (Vite Dev Server hoặc Static production files)
  if (process.env.NODE_ENV !== "production") {
    // Dynamic import để tránh require vite trong production bundle
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
    console.log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
  });
}

startServer();
