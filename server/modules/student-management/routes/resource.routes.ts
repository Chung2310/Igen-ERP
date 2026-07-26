import { Router } from "express";
import { ResourceController } from "../controllers/resource.controller";
import { ResourceCategoryController } from "../controllers/resource-category.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createResourceSchema, updateResourceSchema, createBookingSchema } from "../validations/resource.validation";
import { createResourceCategorySchema } from "../validations/resource-category.validation";
import { idParamSchema } from "../validations/student.validation";
import { requirePermission } from "../../../middleware/auth";

const router = Router();
const requireManage = requirePermission("student:manage") as any;

router.use(authMiddleware);

router.get("/categories", ResourceCategoryController.getList);
router.post("/categories", requireManage, validate(createResourceCategorySchema), ResourceCategoryController.create);
router.delete("/categories/:id", requireManage, validate(idParamSchema, "params"), ResourceCategoryController.delete);

router.post("/", requireManage, validate(createResourceSchema), ResourceController.create);
router.get("/", ResourceController.getList);
router.get("/:id", validate(idParamSchema, "params"), ResourceController.getDetail);
router.patch("/:id", requireManage, validate(idParamSchema, "params"), validate(updateResourceSchema), ResourceController.update);
router.delete("/:id", requireManage, validate(idParamSchema, "params"), ResourceController.delete);
router.post("/:id/bookings", requireManage, validate(idParamSchema, "params"), validate(createBookingSchema), ResourceController.book);
router.delete("/:id/bookings/:bookingId", requireManage, ResourceController.cancelBooking);

export default router;
