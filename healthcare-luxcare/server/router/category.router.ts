import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { categoryController } from "../controller/category.controller";
import { validateRequest } from "../middleware/validation";
import {
  listCategorySchema,
  getCategorySchema,
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
} from "../validation/category.validation";

export const categoryRouter = Router();

categoryRouter.use(requireAuth as any);

categoryRouter.get(
  "/",
  requirePermission("supply:read") as any,
  validateRequest(listCategorySchema),
  categoryController.list as any
);

categoryRouter.get(
  "/:id",
  requirePermission("supply:read") as any,
  validateRequest(getCategorySchema),
  categoryController.get as any
);

categoryRouter.post(
  "/",
  requirePermission("supply:manage") as any,
  validateRequest(createCategorySchema),
  categoryController.create as any
);

categoryRouter.patch(
  "/:id",
  requirePermission("supply:manage") as any,
  validateRequest(updateCategorySchema),
  categoryController.update as any
);

categoryRouter.delete(
  "/:id",
  requirePermission("supply:manage") as any,
  validateRequest(deleteCategorySchema),
  categoryController.delete as any
);
