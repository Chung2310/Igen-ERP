import { Router } from "express";
import { PartnerController } from "../controllers/partner.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createPartnerSchema, updatePartnerSchema, createPayoutSchema, createCommissionLevelSchema } from "../validations/partner.validation";
import { idParamSchema } from "../validations/student.validation";
import { requirePermission } from "../../../middleware/auth";

const router = Router();
const requireManage = requirePermission("partner:manage") as any;

router.use(authMiddleware);

router.get("/commission-levels", PartnerController.getCommissionLevels);
router.post("/commission-levels", requireManage, validate(createCommissionLevelSchema), PartnerController.createCommissionLevel);
router.patch("/commission-levels/:id", requireManage, validate(idParamSchema, "params"), validate(createCommissionLevelSchema), PartnerController.updateCommissionLevel);
router.delete("/commission-levels/:id", requireManage, validate(idParamSchema, "params"), PartnerController.deleteCommissionLevel);

router.post("/bulk", requireManage, PartnerController.bulkCreate);
router.post("/", requireManage, validate(createPartnerSchema), PartnerController.create);
router.get("/", PartnerController.getList);
router.get("/:id", validate(idParamSchema, "params"), PartnerController.getDetail);
router.patch("/:id", requireManage, validate(idParamSchema, "params"), validate(updatePartnerSchema), PartnerController.update);
router.delete("/:id", requireManage, validate(idParamSchema, "params"), PartnerController.delete);
router.post("/:id/payouts", requireManage, validate(idParamSchema, "params"), validate(createPayoutSchema), PartnerController.addPayout);

export default router;
