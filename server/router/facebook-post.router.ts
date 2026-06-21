import { Router } from "express";
import Joi from "joi";
import { facebookPostController } from "../controller/facebook-post.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth, requirePermission } from "../middleware/auth";

export const facebookPostRouter = Router();

const publishSchema = {
  body: Joi.object({
    content: Joi.string().required().messages({
      "any.required": "Nội dung bài viết không được để trống.",
      "string.empty": "Nội dung bài viết không được để trống.",
    }),
    imageUrl: Joi.string().uri().optional().allow("").messages({
      "string.uri": "imageUrl phải là một đường dẫn URL hợp lệ.",
    }),
    videoUrl: Joi.string().uri().optional().allow("").messages({
      "string.uri": "videoUrl phải là một đường dẫn URL hợp lệ.",
    }),
    pageId: Joi.string().required().messages({
      "any.required": "Page ID không được để trống.",
      "string.empty": "Page ID không được để trống.",
    }),
    accessToken: Joi.string().required().messages({
      "any.required": "Access Token không được để trống.",
      "string.empty": "Access Token không được để trống.",
    }),
  }),
};

const validateTokenSchema = {
  body: Joi.object({
    pageId: Joi.string().required(),
    accessToken: Joi.string().required(),
  }),
};

// Route đăng bài viết lên Facebook Page qua n8n (Yêu cầu đăng nhập và có quyền marketing:post)
facebookPostRouter.post(
  "/publish",
  requireAuth as any,
  requirePermission("marketing:post") as any,
  validateRequest(publishSchema),
  facebookPostController.publish as any
);

// Route xác thực token liên kết Page Facebook qua n8n (Yêu cầu đăng nhập và có quyền marketing:post)
facebookPostRouter.post(
  "/validate-token",
  requireAuth as any,
  requirePermission("marketing:post") as any,
  validateRequest(validateTokenSchema),
  facebookPostController.validateToken as any
);

// Route đăng nhập bằng tài khoản/mật khẩu Facebook để lấy Page ID & Token (Hỗ trợ demo/giả lập & xử lý checkpoint)
facebookPostRouter.post(
  "/login-credentials",
  requireAuth as any,
  facebookPostController.loginWithCredentials as any
);

// Route khởi tạo OAuth Session: Lưu App ID + App Secret của công ty vào DB,
// trả về integrationId để dùng làm state trong OAuth URL (Multi-tenant support)
facebookPostRouter.post(
  "/init-oauth",
  requireAuth as any,
  facebookPostController.initOAuth as any
);

// Route Callback OAuth Facebook (nhận redirect_uri từ Facebook Login, thực hiện trao đổi token và postMessage về UI)
facebookPostRouter.get(
  "/oauth-callback",
  facebookPostController.oauthCallback as any
);

// Route lấy cấu hình App ID từ Backend (ưu tiên từ DB của công ty, fallback về .env)
facebookPostRouter.get(
  "/config",
  requireAuth as any,
  facebookPostController.getConfig as any
);

// Route Webhook tiếp nhận yêu cầu xóa dữ liệu tự động từ Facebook (Meta Platform requirement)
facebookPostRouter.post(
  "/data-deletion-callback",
  facebookPostController.dataDeletionCallback as any
);

// Route truy vấn trạng thái yêu cầu xóa dữ liệu của người dùng
facebookPostRouter.get(
  "/data-deletion-status/:code",
  facebookPostController.getDataDeletionStatus as any
);
