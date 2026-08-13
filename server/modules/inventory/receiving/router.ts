import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { receivingController } from "./receiving.controller";

export const receivingRouter = Router();
receivingRouter.get("/suppliers", requirePermission("stock:read") as any, receivingController.listSuppliers as any);
receivingRouter.post("/suppliers", requirePermission("stock:manage") as any, receivingController.createSupplier as any);
receivingRouter.patch("/suppliers/:id", requirePermission("stock:manage") as any, receivingController.updateSupplier as any);
receivingRouter.delete("/suppliers/:id", requirePermission("stock:manage") as any, receivingController.deleteSupplier as any);
receivingRouter.get("/receipts", requirePermission("stock:read") as any, receivingController.listReceipts as any);
receivingRouter.post("/receipts", requirePermission("stock:manage") as any, receivingController.createReceipt as any);
receivingRouter.post("/receipts/:id/submit", requirePermission("stock:manage") as any, receivingController.submitReceipt as any);
receivingRouter.post("/receipts/:id/start-receiving", requirePermission("stock:manage") as any, receivingController.startReceiving as any);
receivingRouter.post("/receipts/:id/confirm", requirePermission("stock:manage") as any, receivingController.confirmReceipt as any);
receivingRouter.post("/receipts/:id/cancel", requirePermission("stock:manage") as any, receivingController.cancelReceipt as any);
