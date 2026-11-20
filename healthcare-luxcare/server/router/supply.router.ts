import { requireSupplyScope } from "../middleware/supply-scope";
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth, requirePermission } from "../middleware/auth";
import { supplyController } from "../controller/supply.controller";
import { validateRequest } from "../middleware/validation";
import {
  listSupplySchema,
  getSupplySchema,
  createSupplySchema,
  updateSupplySchema,
  deleteSupplySchema,
  stockInSchema,
  stockOutSchema,
  batchStockSchema,
} from "../validation/supply.validation";

export const supplyRouter = Router();

const uploadDir = path.join(process.cwd(), "uploads", "supplies");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9-]/g, "_");
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

supplyRouter.use(requireAuth as any);
supplyRouter.use(requireSupplyScope as any);
supplyRouter.post(
  "/:id/restore",
  requirePermission("supply:manage") as any,
  validateRequest(getSupplySchema),
  supplyController.restore as any,
);

supplyRouter.get("/stats", requirePermission("supply:read") as any, supplyController.stats as any);
supplyRouter.get("/export", requirePermission("supply:read") as any, supplyController.exportExcel as any);
supplyRouter.get("/transactions/all", requirePermission("supply:read") as any, supplyController.allTransactions as any);
supplyRouter.get(
  "/transactions/export",
  requirePermission("supply:read") as any,
  supplyController.exportTransactionsExcel as any,
);
supplyRouter.post(
  "/transactions/batch",
  requirePermission("supply:manage") as any,
  validateRequest(batchStockSchema),
  supplyController.batchStock as any,
);
supplyRouter.post(
  "/transactions/drafts",
  requirePermission("supply:manage") as any,
  validateRequest(batchStockSchema),
  supplyController.createVoucherDraft as any,
);
supplyRouter.patch(
  "/transactions/drafts/:id",
  requirePermission("supply:manage") as any,
  validateRequest(batchStockSchema),
  supplyController.updateVoucherDraft as any,
);
supplyRouter.post(
  "/transactions/drafts/:id/complete",
  requirePermission("supply:manage") as any,
  supplyController.completeVoucherDraft as any,
);

supplyRouter.get(
  "/",
  requirePermission("supply:read") as any,
  validateRequest(listSupplySchema),
  supplyController.list as any,
);

supplyRouter.get(
  "/:id",
  requirePermission("supply:read") as any,
  validateRequest(getSupplySchema),
  supplyController.get as any,
);

supplyRouter.get(
  "/:id/transactions",
  requirePermission("supply:read") as any,
  validateRequest(getSupplySchema),
  supplyController.transactions as any,
);

supplyRouter.post(
  "/",
  requirePermission("supply:manage") as any,
  validateRequest(createSupplySchema),
  supplyController.create as any,
);

supplyRouter.patch(
  "/:id",
  requirePermission("supply:manage") as any,
  validateRequest(updateSupplySchema),
  supplyController.update as any,
);

supplyRouter.delete(
  "/:id",
  requirePermission("supply:manage") as any,
  validateRequest(deleteSupplySchema),
  supplyController.remove as any,
);

supplyRouter.post(
  "/:id/stock-in",
  requirePermission("supply:manage") as any,
  validateRequest(stockInSchema),
  supplyController.stockIn as any,
);

supplyRouter.post(
  "/:id/stock-out",
  requirePermission("supply:manage") as any,
  validateRequest(stockOutSchema),
  supplyController.stockOut as any,
);

supplyRouter.post(
  "/upload-files",
  requirePermission("supply:manage") as any,
  upload.array("files", 10),
  supplyController.uploadFiles as any,
);
