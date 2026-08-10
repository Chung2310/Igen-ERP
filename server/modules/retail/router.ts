import { Router } from "express";
import { retailSettingsRoutes } from "./routes/retail-settings.routes";
import { retailCustomerRoutes } from "./routes/retail-customer.routes";
import { cashierShiftRoutes } from "./routes/cashier-shift.routes";
import { retailOrderRoutes } from "./routes/retail-order.routes";
import { retailInvoiceRoutes } from "./routes/retail-invoice.routes";
import { retailReportRoutes } from "./routes/retail-report.routes";

export const retailRouter = Router();
retailRouter.use("/retail/settings", retailSettingsRoutes);
retailRouter.use("/retail/customers", retailCustomerRoutes);
retailRouter.use("/retail/shifts", cashierShiftRoutes);
retailRouter.use("/retail/orders", retailOrderRoutes);
retailRouter.use("/retail/invoices", retailInvoiceRoutes);
retailRouter.use("/retail/reports", retailReportRoutes);
