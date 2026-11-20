import { Router } from "express";
import multer from "multer";
import { requireAuth, requirePermission } from "../middleware/auth";
import { equipmentController } from "../controller/equipment.controller";
import { equipmentBorrowController } from "../controller/equipment-borrow.controller";
import { validateRequest } from "../middleware/validation";
import {
  listEquipmentSchema,
  getEquipmentSchema,
  createEquipmentSchema,
  updateEquipmentSchema,
  deleteEquipmentSchema,
  addLegalDocumentSchema,
  deleteLegalDocumentSchema,
  recordInspectionSchema,
  listInspectionsSchema,
  deleteInspectionRecordSchema,
} from "../validation/equipment.validation";
import {
  borrowHistorySchema,
  cancelBorrowRequestSchema,
  createBorrowRequestSchema,
  createReturnRequestSchema,
  decideBorrowRequestSchema,
  listBorrowRequestsSchema,
} from "../validation/equipment-borrow.validation";

export const equipmentRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

equipmentRouter.use(requireAuth as any);

equipmentRouter.get(
  "/",
  requirePermission("equipment:read") as any,
  validateRequest(listEquipmentSchema),
  equipmentController.list as any,
);

equipmentRouter.get(
  "/compliance-summary",
  requirePermission("equipment:read") as any,
  equipmentController.getComplianceSummary as any,
);

equipmentRouter.get("/export", requirePermission("equipment:read") as any, equipmentController.exportExcel as any);

equipmentRouter.get("/borrow-requests", validateRequest(listBorrowRequestsSchema), equipmentBorrowController.list as any);
equipmentRouter.delete("/borrow-requests/:requestId", validateRequest(cancelBorrowRequestSchema), equipmentBorrowController.cancel as any);
equipmentRouter.patch(
  "/borrow-requests/:requestId/decision",
  requirePermission("equipment:manage") as any,
  validateRequest(decideBorrowRequestSchema),
  equipmentBorrowController.decide as any,
);
equipmentRouter.post("/:id/borrow-requests", validateRequest(createBorrowRequestSchema), equipmentBorrowController.createBorrow as any);
equipmentRouter.post("/:id/return-requests", validateRequest(createReturnRequestSchema), equipmentBorrowController.createReturn as any);
equipmentRouter.get("/:id/borrow-history", validateRequest(borrowHistorySchema), equipmentBorrowController.history as any);

// Hồ sơ pháp lý & Kiểm định
equipmentRouter.post(
  "/:id/legal-documents",
  requirePermission("equipment:manage") as any,
  validateRequest(addLegalDocumentSchema),
  equipmentController.addLegalDocument as any,
);

equipmentRouter.delete(
  "/:id/legal-documents/:docId",
  requirePermission("equipment:manage") as any,
  validateRequest(deleteLegalDocumentSchema),
  equipmentController.removeLegalDocument as any,
);

equipmentRouter.get(
  "/:id/inspections",
  requirePermission("equipment:read") as any,
  validateRequest(listInspectionsSchema),
  equipmentController.listInspections as any,
);

equipmentRouter.post(
  "/:id/inspections",
  requirePermission("equipment:manage") as any,
  validateRequest(recordInspectionSchema),
  equipmentController.recordInspection as any,
);

equipmentRouter.delete(
  "/:id/inspections/:recordId",
  requirePermission("equipment:manage") as any,
  validateRequest(deleteInspectionRecordSchema),
  equipmentController.deleteInspectionRecord as any,
);

equipmentRouter.get(
  "/:id",
  requirePermission("equipment:read") as any,
  validateRequest(getEquipmentSchema),
  equipmentController.get as any,
);


equipmentRouter.post(
  "/",
  requirePermission("equipment:manage") as any,
  validateRequest(createEquipmentSchema),
  equipmentController.create as any,
);

equipmentRouter.post(
  "/import",
  requirePermission("equipment:manage") as any,
  upload.single("file"),
  equipmentController.importExcel as any,
);

equipmentRouter.patch(
  "/:id",
  requirePermission("equipment:manage") as any,
  validateRequest(updateEquipmentSchema),
  equipmentController.update as any,
);

equipmentRouter.delete(
  "/:id",
  requirePermission("equipment:manage") as any,
  validateRequest(deleteEquipmentSchema),
  equipmentController.remove as any,
);
