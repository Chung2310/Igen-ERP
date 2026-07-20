import { Router } from "express";
import { CustomFieldController } from "../controllers/custom-field.controller";
import { authMiddleware, requireRoles } from "../middlewares/auth.middleware";
import { errorMiddleware } from "../middlewares/error.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createFieldSchema, fieldParamsSchema, listQuerySchema, moduleParamSchema, updateFieldSchema } from "../validations/custom-field.validation";
import { customFieldUpload } from "../config/cloudinary";
import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";

const router = Router();
const customFieldUploadRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Quá nhiều yêu cầu tải tệp. Vui lòng thử lại sau." },
});

router.use(authMiddleware);

router.get("/:moduleKey", validate(moduleParamSchema, "params"), validate(listQuerySchema, "query"), CustomFieldController.list);
router.post("/:moduleKey", requireRoles("superadmin", "admin", "manager"), validate(moduleParamSchema, "params"), validate(createFieldSchema), CustomFieldController.create);
router.patch("/:moduleKey/:id", requireRoles("superadmin", "admin", "manager"), validate(fieldParamsSchema, "params"), validate(updateFieldSchema), CustomFieldController.update);
router.post("/:moduleKey/:id/delete", requireRoles("superadmin", "admin", "manager"), validate(fieldParamsSchema, "params"), CustomFieldController.delete);
router.post("/:moduleKey/:id/archive", requireRoles("superadmin", "admin", "manager"), validate(fieldParamsSchema, "params"), CustomFieldController.archive);
router.post("/:moduleKey/:id/restore", requireRoles("superadmin", "admin", "manager"), validate(fieldParamsSchema, "params"), CustomFieldController.restore);
router.post(
  "/:moduleKey/:id/upload",
  customFieldUploadRateLimiter,
  validate(fieldParamsSchema, "params"),
  (req: Request, res: Response, next: NextFunction) => customFieldUpload.single("file")(req, res, (error) => {
    if (error) return res.status(400).json({ success: false, error: error.message });
    next();
  }),
  CustomFieldController.upload,
);
router.use(errorMiddleware);

export default router;
