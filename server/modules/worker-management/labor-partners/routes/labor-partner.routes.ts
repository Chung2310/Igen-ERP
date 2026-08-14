import { Router } from "express";
import { requirePermission } from "../../../../middleware/auth";
import { validate } from "../../middlewares/validate.middleware";
import { laborPartnerController } from "../controllers/labor-partner.controller";
import { commissionPolicyController } from "../controllers/commission-policy.controller";
import { workerReferralController } from "../controllers/worker-referral.controller";
import { settlementController } from "../controllers/settlement.controller";
import { laborPartnerReportController } from "../controllers/labor-partner-report.controller";
import { partnerKpiController } from "../controllers/partner-kpi.controller";
import { LABOR_PARTNER_MANAGE_PERMISSION, LABOR_PARTNER_POLICY_MANAGE_PERMISSION, LABOR_PARTNER_PAYOUT_MANAGE_PERMISSION, LABOR_PARTNER_READ_PERMISSIONS, LABOR_PARTNER_SETTLEMENT_APPROVE_PERMISSION, LABOR_PARTNER_SETTLEMENT_CALCULATE_PERMISSION } from "../permissions";
import { approveSettlementSchema, calculateSettlementSchema, createAdjustmentSchema, createLaborPartnerSchema, laborPartnerReportSchema, listLaborPartnerSchema, listSettlementSchema, partnerIdParamSchema, payoutIdParamSchema, payoutSettlementSchema, settlementIdParamSchema, updateLaborPartnerSchema, voidSettlementSchema } from "../validations/labor-partner.validation";
import { commissionPolicySchema, policyCloneSchema, policyIdParamSchema } from "../validations/commission-policy.validation";
import { createWorkerReferralSchema, endWorkerReferralSchema, referralIdParamSchema, workerIdParamSchema } from "../validations/worker-referral.validation";
import { listPartnerKpiSchema, partnerKpiPartnerParamSchema, upsertPartnerKpiSchema } from "../validations/partner-kpi.validation";

export const laborPartnerRoutes = Router();
const read = requirePermission([...LABOR_PARTNER_READ_PERMISSIONS]) as any;
const manage = requirePermission(LABOR_PARTNER_MANAGE_PERMISSION) as any;
const policyManage = requirePermission(LABOR_PARTNER_POLICY_MANAGE_PERMISSION) as any;
const calculate = requirePermission(LABOR_PARTNER_SETTLEMENT_CALCULATE_PERMISSION) as any;
const approve = requirePermission(LABOR_PARTNER_SETTLEMENT_APPROVE_PERMISSION) as any;
const payout = requirePermission(LABOR_PARTNER_PAYOUT_MANAGE_PERMISSION) as any;

laborPartnerRoutes.get("/", read, validate(listLaborPartnerSchema, "query"), laborPartnerController.list as any);
laborPartnerRoutes.post("/", manage, validate(createLaborPartnerSchema), laborPartnerController.create as any);

laborPartnerRoutes.get("/policies", read, commissionPolicyController.list as any);
laborPartnerRoutes.post("/policies", policyManage, validate(commissionPolicySchema), commissionPolicyController.create as any);
laborPartnerRoutes.get("/policies/:policyId", read, validate(policyIdParamSchema, "params"), commissionPolicyController.detail as any);
laborPartnerRoutes.patch("/policies/:policyId", policyManage, validate(policyIdParamSchema, "params"), validate(commissionPolicySchema), commissionPolicyController.update as any);
laborPartnerRoutes.post("/policies/:policyId/activate", policyManage, validate(policyIdParamSchema, "params"), commissionPolicyController.activate as any);
laborPartnerRoutes.post("/policies/:policyId/retire", policyManage, validate(policyIdParamSchema, "params"), commissionPolicyController.retire as any);
laborPartnerRoutes.delete("/policies/:policyId", policyManage, validate(policyIdParamSchema, "params"), commissionPolicyController.remove as any);
laborPartnerRoutes.post("/policies/:policyId/clone", policyManage, validate(policyIdParamSchema, "params"), validate(policyCloneSchema), commissionPolicyController.clone as any);

laborPartnerRoutes.get("/kpi", read, validate(listPartnerKpiSchema, "query"), partnerKpiController.list as any);
laborPartnerRoutes.put("/kpi/:partnerId", manage, validate(partnerKpiPartnerParamSchema, "params"), validate(upsertPartnerKpiSchema), partnerKpiController.upsert as any);

laborPartnerRoutes.get("/workers/:workerId/referral", read, validate(workerIdParamSchema, "params"), workerReferralController.listForWorker as any);
laborPartnerRoutes.get("/:partnerId/referrals", read, validate(partnerIdParamSchema, "params"), workerReferralController.list as any);
laborPartnerRoutes.post("/:partnerId/referrals", manage, validate(partnerIdParamSchema, "params"), validate(createWorkerReferralSchema), workerReferralController.create as any);
laborPartnerRoutes.post("/:partnerId/referrals/:referralId/confirm", manage, validate(referralIdParamSchema, "params"), workerReferralController.confirm as any);
laborPartnerRoutes.post("/:partnerId/referrals/:referralId/end", manage, validate(referralIdParamSchema, "params"), validate(endWorkerReferralSchema), workerReferralController.end as any);
laborPartnerRoutes.post("/settlements/calculate", calculate, validate(calculateSettlementSchema), settlementController.calculate as any);
laborPartnerRoutes.get("/dashboard", read, validate(laborPartnerReportSchema, "query"), laborPartnerReportController.dashboard as any);
laborPartnerRoutes.get("/reports/commission", read, validate(laborPartnerReportSchema, "query"), laborPartnerReportController.commission as any);
laborPartnerRoutes.get("/reports/commission/export", read, validate(laborPartnerReportSchema, "query"), laborPartnerReportController.export as any);
laborPartnerRoutes.get("/settlements", read, validate(listSettlementSchema, "query"), settlementController.list as any);
laborPartnerRoutes.get("/settlements/:settlementId", read, validate(settlementIdParamSchema, "params"), settlementController.detail as any);
laborPartnerRoutes.post("/settlements/:settlementId/recalculate", calculate, validate(settlementIdParamSchema, "params"), settlementController.recalculate as any);
laborPartnerRoutes.post("/settlements/:settlementId/void", approve, validate(settlementIdParamSchema, "params"), validate(voidSettlementSchema), settlementController.void as any);
laborPartnerRoutes.post("/settlements/:settlementId/adjustments", approve, validate(settlementIdParamSchema, "params"), validate(createAdjustmentSchema), settlementController.createAdjustment as any);
laborPartnerRoutes.post("/settlements/:settlementId/approve", approve, validate(settlementIdParamSchema, "params"), validate(approveSettlementSchema), settlementController.approve as any);
laborPartnerRoutes.post("/settlements/:settlementId/payouts", payout, validate(settlementIdParamSchema, "params"), validate(payoutSettlementSchema), settlementController.payout as any);
laborPartnerRoutes.post("/payouts/:payoutId/reverse", payout, validate(payoutIdParamSchema, "params"), settlementController.reversePayout as any);

laborPartnerRoutes.get("/:partnerId/overview", read, validate(partnerIdParamSchema, "params"), laborPartnerController.overview as any);
laborPartnerRoutes.get("/:partnerId", read, validate(partnerIdParamSchema, "params"), laborPartnerController.detail as any);
laborPartnerRoutes.patch("/:partnerId", manage, validate(partnerIdParamSchema, "params"), validate(updateLaborPartnerSchema), laborPartnerController.update as any);
laborPartnerRoutes.delete("/:partnerId", manage, validate(partnerIdParamSchema, "params"), laborPartnerController.remove as any);
