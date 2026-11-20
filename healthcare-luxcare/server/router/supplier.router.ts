import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { supplierController } from "../controller/supplier.controller";
import { validateRequest } from "../middleware/validation";
import {
  listSupplierSchema,
  getSupplierSchema,
  createSupplierSchema,
  updateSupplierSchema,
  deleteSupplierSchema,
} from "../validation/supplier.validation";

export const supplierRouter = Router();

supplierRouter.use(requireAuth as any);

supplierRouter.get(
  "/",
  requirePermission("supply:read") as any,
  validateRequest(listSupplierSchema),
  supplierController.list as any
);

supplierRouter.get(
  "/:id",
  requirePermission("supply:read") as any,
  validateRequest(getSupplierSchema),
  supplierController.get as any
);

supplierRouter.post(
  "/",
  requirePermission("supply:manage") as any,
  validateRequest(createSupplierSchema),
  supplierController.create as any
);

supplierRouter.patch(
  "/:id",
  requirePermission("supply:manage") as any,
  validateRequest(updateSupplierSchema),
  supplierController.update as any
);

supplierRouter.delete(
  "/:id",
  requirePermission("supply:manage") as any,
  validateRequest(deleteSupplierSchema),
  supplierController.delete as any
);
