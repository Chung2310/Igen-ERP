import { Router } from "express";
import { ResourceController } from "../controllers/resource.controller";
import { ResourceCategoryController } from "../controllers/resource-category.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createResourceSchema, updateResourceSchema, createBookingSchema } from "../validations/resource.validation";
import { createResourceCategorySchema } from "../validations/resource-category.validation";
import { idParamSchema } from "../validations/student.validation";

const router = Router();

router.use(authMiddleware);

router.get("/categories", ResourceCategoryController.getList);
router.post("/categories", validate(createResourceCategorySchema), ResourceCategoryController.create);
router.delete("/categories/:id", validate(idParamSchema, "params"), ResourceCategoryController.delete);

router.post("/", validate(createResourceSchema), ResourceController.create);
router.get("/", ResourceController.getList);
router.get("/:id", validate(idParamSchema, "params"), ResourceController.getDetail);
router.patch("/:id", validate(idParamSchema, "params"), validate(updateResourceSchema), ResourceController.update);
router.delete("/:id", validate(idParamSchema, "params"), ResourceController.delete);
router.post("/:id/bookings", validate(idParamSchema, "params"), validate(createBookingSchema), ResourceController.book);
router.delete("/:id/bookings/:bookingId", ResourceController.cancelBooking);

export default router;
