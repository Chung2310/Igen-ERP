import { Router } from "express";
import { ModuleSettingsController } from "../controllers/module-settings.controller";
import { authMiddleware, requireRoles } from "../middlewares/auth.middleware";
import { errorMiddleware } from "../middlewares/error.middleware";
import { validate } from "../middlewares/validate.middleware";
import { updateModuleSettingsSchema } from "../validations/module-settings.validation";

const router = Router();

router.use(authMiddleware);

// Đọc: mọi tài khoản trong công ty đều cần entityPreset để render đúng nhãn
// (học viên/lao động) trên toàn hệ thống, nên không gác thêm quyền cấu hình.
router.get("/", ModuleSettingsController.get);

// Ghi: loại hình doanh nghiệp là đặc quyền SuperAdmin — doanh nghiệp không tự sửa.
router.patch(
  "/",
  requireRoles("superadmin"),
  validate(updateModuleSettingsSchema),
  ModuleSettingsController.update,
);

router.use(errorMiddleware);

export default router;
