import { ReceivableLedgerService } from "../services/receivable-ledger.service";
import { registerFinanceReceivableConsumers } from "./receivable.consumer";

export function registerFinanceConsumers() {
  registerFinanceReceivableConsumers(ReceivableLedgerService);
}
