import { Router } from "express";
import { registerFinanceConsumers } from "./consumers";
import { financeReceivableRoutes } from "./routes/receivable.routes";
registerFinanceConsumers();
export const financeRouter = Router();
financeRouter.use("/receivables", financeReceivableRoutes);
