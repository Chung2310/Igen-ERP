import { financeCutoverEnabled } from "../config/finance-cutover";
import { ReceivableEntryModel } from "../models/receivable-entry.model";
import { ReceivableLedgerService } from "./receivable-ledger.service";
import { ReceivableQueryService } from "./receivable-query.service";

type Side = { history(...args: any[]): Promise<any>; adjust(...args: any[]): Promise<any>; reverse?(...args: any[]): Promise<any> };

export function createFinanceRetailAdapter(dependencies: { finance: Side; legacy: Side; cutover?: () => boolean }) {
  const selected = () => (dependencies.cutover || financeCutoverEnabled)() ? dependencies.finance : dependencies.legacy;
  return {
    history: (...args: any[]) => selected().history(...args),
    adjust: (...args: any[]) => selected().adjust(...args),
    reverse: (...args: any[]) => {
      const side = selected(); if (!side.reverse) throw new Error("RECEIVABLE_REVERSAL_NOT_SUPPORTED");
      return side.reverse(...args);
    },
  };
}

export const FinanceRetailCompatibilityService = {
  async history(scope: any, customerId: string, query: any) {
    const page = Number(query?.page || 1), limit = Number(query?.limit || 20);
    const listed: any = await ReceivableQueryService.list(scope, { ...query, customerId, page, limit });
    const details = await Promise.all((listed.items || []).map((item: any) => ReceivableQueryService.detail(scope, String(item._id))));
    const items = details.flatMap((detail: any) => detail?.entries || []).sort((a: any, b: any) => new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf());
    return { items, total: items.length, page, limit, currentBalance: (listed.items || []).reduce((sum: number, item: any) => sum + Number(item.balance), 0) };
  },
  adjust(scope: any, input: any, actor: any) {
    const receivableId = String(input?.receivableId || "").trim();
    if (!receivableId) throw new Error("RECEIVABLE_ID_REQUIRED_AFTER_CUTOVER");
    return ReceivableLedgerService.adjust(scope, receivableId, input, actor);
  },
  async reverse(scope: any, legacyEntryId: string, reason: string, actor: any) {
    const entry: any = await ReceivableEntryModel.findOne({ ...scope, idempotencyKey: `legacy:retail-entry:${legacyEntryId}` }).lean();
    if (!entry) throw new Error("RECEIVABLE_ENTRY_NOT_FOUND");
    return ReceivableLedgerService.reverse(scope, String(entry.receivableId), String(entry._id), { reason, idempotencyKey: `cutover:reversal:${entry._id}` }, actor);
  },
};
