import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { geminiSwagger } from "./gemini.swagger";

const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "iGen ERP Smart AI API Docs",
    version: "1.0.0",
    description: "Tài liệu API Swagger cho các tính năng AI Marketing và Chatbot CRM của iGen ERP.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Cơ sở phục vụ cục bộ",
    },
  ],
  paths: {
    ...geminiSwagger.paths,
  },
};

export const swaggerRouter = Router();

// Phục vụ tài liệu Swagger UI tại đường dẫn /api-docs
swaggerRouter.use("/", swaggerUi.serve as any, swaggerUi.setup(swaggerDocument) as any);
