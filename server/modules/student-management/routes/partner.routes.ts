import { Router } from "express";
import { PartnerController } from "../controllers/partner.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createPartnerSchema, updatePartnerSchema, createPayoutSchema, createCommissionLevelSchema } from "../validations/partner.validation";
import { idParamSchema } from "../validations/student.validation";

const router = Router();

router.use(authMiddleware);

router.get("/commission-levels", PartnerController.getCommissionLevels);
router.post("/commission-levels", validate(createCommissionLevelSchema), PartnerController.createCommissionLevel);
router.delete("/commission-levels/:id", validate(idParamSchema, "params"), PartnerController.deleteCommissionLevel);

router.post("/bulk", PartnerController.bulkCreate);
router.post("/", validate(createPartnerSchema), PartnerController.create);
router.get("/", PartnerController.getList);
router.get("/:id", validate(idParamSchema, "params"), PartnerController.getDetail);
router.patch("/:id", validate(idParamSchema, "params"), validate(updatePartnerSchema), PartnerController.update);
router.delete("/:id", validate(idParamSchema, "params"), PartnerController.delete);
router.post("/:id/payouts", validate(idParamSchema, "params"), validate(createPayoutSchema), PartnerController.addPayout);

export default router;
