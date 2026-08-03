import { Router } from "express";
import { StandardFieldController } from "../controllers/standard-field.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireAnyPermission } from "../../../middleware/auth";
import { STUDENT_AREA_PERMISSIONS } from "../permissions";
import { errorMiddleware } from "../middlewares/error.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  replaceStandardFieldsSchema,
  standardFieldModuleParamSchema,
} from "../validations/standard-field.validation";

const router = Router();

router.use(authMiddleware);

// Đọc: mọi người dùng đã đăng nhập đều cần cấu hình này để dựng form.
router.get("/:moduleKey", validate(standardFieldModuleParamSchema, "params"), StandardFieldController.list);

// Ghi: dùng chung quyền với trường tùy chỉnh, vì cùng là chỉnh cấu trúc form.
router.put(
  "/:moduleKey",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requireAnyPermission([...STUDENT_AREA_PERMISSIONS["custom-field"].manage]) as any,
  validate(standardFieldModuleParamSchema, "params"),
  validate(replaceStandardFieldsSchema),
  StandardFieldController.replace,
);

router.use(errorMiddleware);

export default router;
