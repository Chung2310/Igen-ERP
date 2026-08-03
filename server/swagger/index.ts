import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { mediaSwagger } from "./media.swagger";
import { authSwagger } from "./auth.swagger";
import { permissionSwagger } from "./permission.swagger";
import { rolePermissionSwagger } from "./role-permission.swagger";
import { crudSwagger } from "./crud.swagger";
import { chatSwagger } from "./chat.swagger";
import { notificationSwagger } from "./notification.swagger";
import { superAdminSwagger } from "./super-admin.swagger";
import { analyticsSwagger } from "./analytics.swagger";
import { workerProjectSwagger } from "./worker-project.swagger";

const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "iGen ERP Smart AI API Docs",
    version: "1.0.0",
    description: "Tài liệu API Swagger của iGen ERP.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Cơ sở phục vụ cục bộ",
    },
  ],
  paths: {
    ...mediaSwagger.paths,
    ...authSwagger.paths,
    ...permissionSwagger.paths,
    ...rolePermissionSwagger.paths,
    ...crudSwagger.paths,
    ...chatSwagger.paths,
    ...notificationSwagger.paths,
    ...superAdminSwagger.paths,
    ...analyticsSwagger.paths,
    ...workerProjectSwagger.paths,
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Điền JWT Access Token vào ô dưới đây dạng: eyJhbG...",
      },
    },
  },
};

export const swaggerRouter = Router();

// Phục vụ tài liệu Swagger UI tại đường dẫn /api-docs
swaggerRouter.use("/", swaggerUi.serve as any, swaggerUi.setup(swaggerDocument) as any);
