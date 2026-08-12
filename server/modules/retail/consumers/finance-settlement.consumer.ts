import { registerDomainConsumer } from "../../../integrations/shared/event-bus";
import { applyFinanceReceivableSettlement } from "../contracts";

export function registerRetailFinanceSettlementConsumer() {
  try {
    registerDomainConsumer("finance.receivable.settled", "retail.finance-settlement", applyFinanceReceivableSettlement, { requiresModule: "retail" });
  } catch (error) {
    if (!String((error as Error).message).includes("đã được đăng ký")) throw error;
  }
}
