import { payrollPeriodController } from "./payroll-period.controller";
import { payrollRunController } from "./payroll-run.controller";
import { payrollPolicyController } from "./payroll-policy.controller";
import { payrollPaymentController } from "./payroll-payment.controller";
import { payrollPayslipController } from "./payroll-payslip.controller";
import { payrollAdjustmentController } from "./payroll-adjustment.controller";

export const payrollController = {
  ...payrollPeriodController,
  ...payrollRunController,
  ...payrollPolicyController,
  ...payrollPaymentController,
  ...payrollPayslipController,
  ...payrollAdjustmentController,
};
