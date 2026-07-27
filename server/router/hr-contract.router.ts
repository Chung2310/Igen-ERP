import { Router } from "express";
import Joi from "joi";
import { hrContractController } from "../controller/hr-contract.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModule } from "../middleware/require-module";
import { validateRequest } from "../middleware/validation";

export const hrContractRouter = Router();
const id = Joi.string().hex().length(24).required();
const url = Joi.string().uri().allow("", null);
const contractBody = Joi.object({ contractType: Joi.string().trim().max(100).required(), employeeId: id, startDate: Joi.date().iso().required(), endDate: Joi.date().iso().min(Joi.ref("startDate")).required(), status: Joi.string().valid("draft", "active", "expired", "terminated").required(), contractFileUrl: url, signedImageUrl: url, note: Joi.string().allow("").max(1000) });
const updateBody = Joi.object({ contractType: Joi.string().trim().max(100), employeeId: Joi.string().hex().length(24), startDate: Joi.date().iso(), endDate: Joi.date().iso(), status: Joi.string().valid("draft", "active", "expired", "terminated"), contractFileUrl: url, signedImageUrl: url, note: Joi.string().allow("").max(1000) }).min(1);
const extensionBody = Joi.object({ newEndDate: Joi.date().iso().required(), extensionDate: Joi.date().iso().required(), reason: Joi.string().allow("").max(1000), extensionFileUrl: url, signedImageUrl: url });

hrContractRouter.use(requireAuth as any, requireModule("hr"));
hrContractRouter.get("/", requirePermission("hr:read") as any, hrContractController.list as any);
hrContractRouter.post("/", requirePermission("user:manage") as any, validateRequest({ body: contractBody }), hrContractController.create as any);
hrContractRouter.patch("/:id", requirePermission("user:manage") as any, validateRequest({ params: Joi.object({ id }), body: updateBody }), hrContractController.update as any);
hrContractRouter.get("/extensions/list", requirePermission("hr:read") as any, hrContractController.listExtensions as any);
hrContractRouter.post("/:id/extensions", requirePermission("user:manage") as any, validateRequest({ params: Joi.object({ id }), body: extensionBody }), hrContractController.extend as any);
