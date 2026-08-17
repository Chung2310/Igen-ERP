import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { receivingController } from "./receiving.controller";

export const receivingRouter = Router();
receivingRouter.get("/suppliers", requirePermission("inventory:read") as any, receivingController.listSuppliers as any);
receivingRouter.post("/suppliers", requirePermission("inventory:manage") as any, receivingController.createSupplier as any);
receivingRouter.patch("/suppliers/:id", requirePermission("inventory:manage") as any, receivingController.updateSupplier as any);
receivingRouter.delete("/suppliers/:id", requirePermission("inventory:manage") as any, receivingController.deleteSupplier as any);
receivingRouter.get("/receipts", requirePermission("inventory:read") as any, receivingController.listReceipts as any);
receivingRouter.post("/receipts", requirePermission("inventory:manage") as any, receivingController.createReceipt as any);
receivingRouter.patch("/receipts/:id", requirePermission("inventory:manage") as any, receivingController.updateReceipt as any);
receivingRouter.post("/receipts/:id/submit", requirePermission("inventory:manage") as any, receivingController.submitReceipt as any);
receivingRouter.post("/receipts/:id/start-receiving", requirePermission("inventory:manage") as any, receivingController.startReceiving as any);
receivingRouter.post("/receipts/:id/confirm", requirePermission("inventory:manage") as any, receivingController.confirmReceipt as any);
receivingRouter.post("/receipts/:id/cancel", requirePermission("inventory:manage") as any, receivingController.cancelReceipt as any);
