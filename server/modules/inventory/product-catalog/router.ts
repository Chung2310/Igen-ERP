import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { productCatalogController } from "./product-catalog.controller";

export const productCatalogRouter = Router();

productCatalogRouter.get("/resources/:kind", requirePermission("inventory:read") as any, productCatalogController.listResources);
productCatalogRouter.post("/resources/:kind", requirePermission("inventory:manage") as any, productCatalogController.createResource);
productCatalogRouter.patch("/resources/:kind/:id", requirePermission("inventory:manage") as any, productCatalogController.updateResource);
productCatalogRouter.delete("/resources/:kind/:id", requirePermission("inventory:manage") as any, productCatalogController.deleteResource);
productCatalogRouter.get("/templates", requirePermission("inventory:read") as any, productCatalogController.listTemplates);
productCatalogRouter.post("/templates", requirePermission("inventory:manage") as any, productCatalogController.createTemplate);
productCatalogRouter.patch("/templates/:id", requirePermission("inventory:manage") as any, productCatalogController.updateTemplate);

productCatalogRouter.get("/products", requirePermission("inventory:read") as any, productCatalogController.list);
  productCatalogRouter.post("/products", requirePermission("inventory:manage") as any, productCatalogController.create);
  productCatalogRouter.post("/products/bulk-create-with-variants", requirePermission("inventory:manage") as any, productCatalogController.bulkCreateWithVariants);
  productCatalogRouter.get("/products/:id", requirePermission("inventory:read") as any, productCatalogController.get);
  productCatalogRouter.patch("/products/:id", requirePermission("inventory:manage") as any, productCatalogController.update);
  productCatalogRouter.delete("/products/:id", requirePermission("inventory:manage") as any, productCatalogController.delete);
productCatalogRouter.post("/products/:id/variants/bulk", requirePermission("inventory:manage") as any, productCatalogController.createVariants);
productCatalogRouter.post("/products/:id/variants", requirePermission("inventory:manage") as any, productCatalogController.createVariant);
productCatalogRouter.patch("/variants/bulk", requirePermission("inventory:manage") as any, productCatalogController.updateVariants);
productCatalogRouter.delete("/variants/bulk", requirePermission("inventory:manage") as any, productCatalogController.deleteVariants);
productCatalogRouter.patch("/variants/:id", requirePermission("inventory:manage") as any, productCatalogController.updateVariant);
