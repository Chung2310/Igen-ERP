import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { payrollPeriodInputRoutes } from "./routes/period-input.routes";
import { payrollFormulaRoutes } from "./routes/formula.routes";
import { payrollPolicyRoutes } from "./routes/policy.routes";
import { payrollRunRoutes } from "./routes/run.routes";
import { payrollPaymentRoutes } from "./routes/payment.routes";
import { payrollPayslipRoutes } from "./routes/payslip.routes";
import { payrollPeriodRoutes } from "./routes/period.routes";

export const payrollRouter = Router();
payrollRouter.use(requireAuth as any);
payrollRouter.use(payrollPeriodInputRoutes);
payrollRouter.use(payrollFormulaRoutes);
payrollRouter.use(payrollRunRoutes);
payrollRouter.use(payrollPolicyRoutes);
payrollRouter.use(payrollPayslipRoutes);
payrollRouter.use(payrollPaymentRoutes);
payrollRouter.use(payrollPeriodRoutes);
