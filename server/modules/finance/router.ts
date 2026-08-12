import { Router } from "express";
import { registerFinanceConsumers } from "./consumers";
registerFinanceConsumers();
export const financeRouter = Router();
