import { Router } from "express";
import { ModuleSettingsController } from "../controllers/module-settings.controller";
import { authMiddleware, requireRoles } from "../middlewares/auth.middleware";
import { errorMiddleware } from "../middlewares/error.middleware";
import { validate } from "../middlewares/validate.middleware";
import { updateModuleSettingsSchema } from "../validations/module-settings.validation";

const router = Router();

router.use(authMiddleware);

router.get("/", ModuleSettingsController.get);
router.patch("/", requireRoles("admin"), validate(updateModuleSettingsSchema), ModuleSettingsController.update);

router.use(errorMiddleware);

export default router;
