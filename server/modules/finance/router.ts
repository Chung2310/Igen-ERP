import { Router } from "express";
import { registerFinanceConsumers } from "./consumers";
import { financeReceivableRoutes } from "./routes/receivable.routes";
import { ensureOverdueScanScheduler } from "./jobs/overdue-scan.job";
import { runOverdueScansForAllScopes } from "./services/overdue-reminder.service";
registerFinanceConsumers();
ensureOverdueScanScheduler(runOverdueScansForAllScopes);
export const financeRouter = Router();
financeRouter.use("/receivables", financeReceivableRoutes);
