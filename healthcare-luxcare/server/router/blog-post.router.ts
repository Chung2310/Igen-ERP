import { blogModerationRouter } from "./blog-moderation.router";
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireBlogPoster } from "../middleware/blog-permission";
import * as controller from "../controller/blog-post.controller";
import { validateBody, createBlogPostSchema, attachmentVisibilitySchema } from "../validation/blog-post.validation";

import * as blogFiles from "../controller/blog-file.controller";
export const blogPostRouter = Router();
blogPostRouter.use(blogModerationRouter);
blogPostRouter.post("/files", requireAuth as any, requireBlogPoster as any, blogFiles.upload as any);
blogPostRouter.get("/files/:id/preview", requireAuth as any, blogFiles.preview as any);
blogPostRouter.get("/files/:id", blogFiles.download as any);

// Lấy thông tin kênh và danh sách bài đăng (bắt buộc đăng nhập để xem)
blogPostRouter.get("/info", requireAuth as any, controller.getChannelInfo as any);
blogPostRouter.get("/", requireAuth as any, controller.listPosts as any);

// Đăng bài viết / tin nhắn (CHỈ tài khoản có Role đặc biệt / quyền blog:post mới được gửi)
blogPostRouter.post(
  "/",
  requireAuth as any,
  requireBlogPoster as any,
  validateBody(createBlogPostSchema),
  controller.createPost as any,
);

// Tương tác like bài viết (tất cả thành viên)
blogPostRouter.post("/:id/like", requireAuth as any, controller.toggleLikePost as any);

// Ghim bài viết (chỉ tài khoản đặc biệt)
blogPostRouter.patch("/:id/pin", requireAuth as any, requireBlogPoster as any, controller.togglePinPost as any);

// Xóa bài viết (chỉ tài khoản đặc biệt)
blogPostRouter.delete("/:id", requireAuth as any, requireBlogPoster as any, controller.deletePost as any);

blogPostRouter.get("/:id", requireAuth as any, controller.getPost as any);
blogPostRouter.patch("/:id/attachment-visibility", requireAuth as any, requireBlogPoster as any,
  validateBody(attachmentVisibilitySchema), controller.updateAttachmentVisibility as any);
blogPostRouter.get("/:id/attachments/:attachmentId/access", requireAuth as any, controller.getAttachmentAccess as any);
