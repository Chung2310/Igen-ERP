import { Router } from "express";
import { ModuleSettingsController } from "../controllers/module-settings.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireAnyPermission } from "../../../middleware/auth";
import { STUDENT_AREA_PERMISSIONS } from "../permissions";
import { errorMiddleware } from "../middlewares/error.middleware";
import { validate } from "../middlewares/validate.middleware";
import { updateModuleSettingsSchema } from "../validations/module-settings.validation";

const router = Router();
const requireManage = requireAnyPermission([...STUDENT_AREA_PERMISSIONS["student-settings"].manage]) as any;

router.use(authMiddleware);

router.get("/", ModuleSettingsController.get);
router.patch("/", requireManage, validate(updateModuleSettingsSchema), ModuleSettingsController.update);

router.use(errorMiddleware);

export default router;
