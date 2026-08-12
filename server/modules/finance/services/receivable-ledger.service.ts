import mongoose, { type ClientSession } from "mongoose";
import type { FinanceBranchScope } from "../contracts";
import type { ReceivableEntryType } from "../interfaces/receivable.interface";
import { ReceivableEntryModel } from "../models/receivable-entry.model";
import { ReceivableModel } from "../models/receivable.model";
import { assertReceivableOperation, deriveReceivableStatus } from "./receivable-rules";
import { publishReceivableSettled } from "../consumers/receivable.consumer";

type Session = unknown;
type Actor = { id?: string; uid?: string; name?: string; displayName?: string };

export interface ReceivableLedgerRepository {
  transaction<T>(work: (session: Session) => Promise<T>): Promise<T>;
  findBySourceEvent(scope: FinanceBranchScope, sourceEventId: string, session: Session): Promise<any | null>;
  findById(scope: FinanceBranchScope, id: string, session: Session): Promise<any | null>;
  findBySource(scope: FinanceBranchScope, sourceType: string, sourceId: string, session: Session): Promise<any | null>;
  createReceivable(values: any, session: Session): Promise<any>;
  updateReceivable(scope: FinanceBranchScope, id: string, values: any, session: Session): Promise<any>;
  createEntry(values: any, session: Session): Promise<any>;
  findEntry(scope: FinanceBranchScope, receivableId: string, entryId: string, session: Session): Promise<any | null>;
  findReversal(scope: FinanceBranchScope, receivableId: string, entryId: string, session: Session): Promise<any | null>;
  findByIdempotency?(scope: FinanceBranchScope, idempotencyKey: string, session: Session): Promise<any | null>;
}

type OpenInput = {
  receivableCode: string; sourceType: string; sourceId: string; sourceCode?: string; sourceEventId: string;
  customerId: string; customerName: string; originalAmount: number; occurredAt: Date; dueDate: Date;
};
type CommandInput = { amount: number; idempotencyKey: string; reason?: string; paymentMethod?: string; reference?: string; direction?: "increase" | "decrease" };
type ReverseInput = { reason: string; idempotencyKey: string };

function actorSnapshot(actor: Actor) {
  return {
    createdBy: String(actor.id || actor.uid || "system"),
    createdByName: String(actor.name || actor.displayName || "Hệ thống"),
  };
}

function requireText(value: unknown, code: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

export function createReceivableLedgerService(
  repository: ReceivableLedgerRepository,
  afterSettled?: (receivable: any) => Promise<void>,
) {
  async function append(
    scope: FinanceBranchScope,
    receivableId: string,
    input: CommandInput & { type: ReceivableEntryType; originalSignedAmount?: number; originalType?: ReceivableEntryType; reversalOfEntryId?: string; terminal?: "void" | "written_off" },
    actor: Actor,
  ) {
    const result = await repository.transaction(async (session) => {
      const prior = repository.findByIdempotency
        ? await repository.findByIdempotency(scope, requireText(input.idempotencyKey, "IDEMPOTENCY_KEY_REQUIRED"), session)
        : null;
      if (prior) {
        const existing = await repository.findById(scope, receivableId, session);
        return { receivable: existing, entry: prior, settledTransition: false };
      }
      const receivable = await repository.findById(scope, receivableId, session);
      if (!receivable) throw new Error("RECEIVABLE_NOT_FOUND");
      if (["settled", "void", "written_off"].includes(receivable.status)) throw new Error("RECEIVABLE_ALREADY_SETTLED");
      const amount = assertReceivableOperation({
        type: input.type, balance: receivable.balance, amount: input.amount, reason: input.reason,
        direction: input.direction, originalSignedAmount: input.originalSignedAmount,
      });
      const balance = receivable.balance + amount;
      if (balance < 0) throw new Error("PAYMENT_EXCEEDS_BALANCE");
      const paidAmount = receivable.paidAmount + (input.type === "payment" ? input.amount : input.type === "reversal" && input.originalType === "payment" ? -Math.abs(input.originalSignedAmount || 0) : 0);
      const adjustedAmount = receivable.adjustedAmount + (input.type === "adjustment" ? amount : input.type === "reversal" && input.originalType === "adjustment" ? amount : 0);
      const entry = await repository.createEntry({
        ...scope, receivableId, customerId: receivable.customerId, type: input.type, amount, balanceAfter: balance,
        reason: input.reason?.trim(), paymentMethod: input.paymentMethod, reference: input.reference,
        idempotencyKey: input.idempotencyKey.trim(), reversalOfEntryId: input.reversalOfEntryId, ...actorSnapshot(actor),
      }, session);
      const status = deriveReceivableStatus({ originalAmount: receivable.originalAmount, paidAmount, balance, terminal: input.terminal });
      const updated = await repository.updateReceivable(scope, receivableId, { balance, paidAmount, adjustedAmount, status }, session);
      return { receivable: updated, entry, settledTransition: receivable.status !== "settled" && status === "settled" };
    });
    if (result.settledTransition && afterSettled) await afterSettled(result.receivable);
    const { settledTransition: _settledTransition, ...response } = result;
    return response;
  }

  return {
    async openFromEvent(scope: FinanceBranchScope, input: OpenInput, actor: Actor) {
      return repository.transaction(async (session) => {
        const replay = await repository.findBySourceEvent(scope, requireText(input.sourceEventId, "SOURCE_EVENT_REQUIRED"), session);
        if (replay) return replay;
        assertReceivableOperation({ type: "charge", balance: 0, amount: input.originalAmount });
        const receivable = await repository.createReceivable({
          ...scope, ...input, originalAmount: input.originalAmount, paidAmount: 0, adjustedAmount: 0,
          balance: input.originalAmount, status: "open", daysOverdue: 0, reminderCount: 0,
        }, session);
        await repository.createEntry({
          ...scope, receivableId: String(receivable._id), customerId: input.customerId, type: "charge",
          amount: input.originalAmount, balanceAfter: input.originalAmount, sourceEventId: input.sourceEventId,
          idempotencyKey: `source:${input.sourceEventId}:charge`, ...actorSnapshot(actor),
        }, session);
        return receivable;
      });
    },
    collect(scope: FinanceBranchScope, id: string, input: CommandInput, actor: Actor) {
      return append(scope, id, { ...input, type: "payment" }, actor);
    },
    adjust(scope: FinanceBranchScope, id: string, input: CommandInput, actor: Actor) {
      return append(scope, id, { ...input, type: "adjustment" }, actor);
    },
    async writeOff(scope: FinanceBranchScope, id: string, input: Omit<CommandInput, "amount">, actor: Actor) {
      const current = await repository.transaction((session) => repository.findById(scope, id, session));
      if (!current) throw new Error("RECEIVABLE_NOT_FOUND");
      return append(scope, id, { ...input, amount: current.balance, type: "write_off", terminal: "written_off" }, actor);
    },
    async reverse(scope: FinanceBranchScope, id: string, entryId: string, input: ReverseInput, actor: Actor) {
      const original = await repository.transaction(async (session) => {
        if (await repository.findReversal(scope, id, entryId, session)) throw new Error("ENTRY_ALREADY_REVERSED");
        const found = await repository.findEntry(scope, id, entryId, session);
        if (!found) throw new Error("ENTRY_NOT_FOUND");
        return found;
      });
      return append(scope, id, {
        ...input, type: "reversal", amount: Math.abs(original.amount), originalSignedAmount: original.amount, originalType: original.type,
        reversalOfEntryId: entryId,
      }, actor);
    },
    async settleFromEvent(scope: FinanceBranchScope, sourceType: string, sourceId: string, input: CommandInput, actor: Actor) {
      const receivable = await repository.transaction((session) => repository.findBySource(scope, sourceType, sourceId, session));
      if (!receivable) throw new Error("RECEIVABLE_NOT_FOUND");
      return append(scope, String(receivable._id), { ...input, type: "payment" }, actor);
    },
    async voidFromEvent(scope: FinanceBranchScope, sourceType: string, sourceId: string, input: { remainingDebt: number; refundedAmount: number; reason: string; idempotencyKey: string }, actor: Actor) {
      const receivable = await repository.transaction((session) => repository.findBySource(scope, sourceType, sourceId, session));
      if (!receivable) throw new Error("RECEIVABLE_NOT_FOUND");
      if (Number(input.remainingDebt) !== receivable.balance) throw new Error("RECEIVABLE_SOURCE_BALANCE_MISMATCH");
      return append(scope, String(receivable._id), {
        type: "reversal", amount: receivable.balance, originalSignedAmount: receivable.balance,
        reason: input.reason, idempotencyKey: input.idempotencyKey, terminal: "void",
      }, actor);
    },
  };
}

const mongooseRepository: ReceivableLedgerRepository = {
  async transaction(work) {
    const session = await mongoose.startSession();
    try { let result: any; await session.withTransaction(async () => { result = await work(session); }); return result; }
    finally { await session.endSession(); }
  },
  findBySourceEvent: (scope, sourceEventId, session) => ReceivableModel.findOne({ ...scope, sourceEventId }).session(session as ClientSession).lean(),
  findById: (scope, id, session) => ReceivableModel.findOne({ ...scope, _id: id }).session(session as ClientSession).lean(),
  findBySource: (scope, sourceType, sourceId, session) => ReceivableModel.findOne({ ...scope, sourceType, sourceId }).session(session as ClientSession).lean(),
  async createReceivable(values, session) { const [item] = await ReceivableModel.create([values], { session: session as ClientSession }); return item.toObject(); },
  async updateReceivable(scope, id, values, session) { return ReceivableModel.findOneAndUpdate({ ...scope, _id: id }, { $set: values }, { new: true, session: session as ClientSession }).lean(); },
  async createEntry(values, session) { const [item] = await ReceivableEntryModel.create([values], { session: session as ClientSession }); return item.toObject(); },
  findEntry: (scope, receivableId, entryId, session) => ReceivableEntryModel.findOne({ ...scope, receivableId, _id: entryId }).session(session as ClientSession).lean(),
  findReversal: (scope, receivableId, entryId, session) => ReceivableEntryModel.findOne({ ...scope, receivableId, reversalOfEntryId: entryId }).session(session as ClientSession).lean(),
  findByIdempotency: (scope, idempotencyKey, session) => ReceivableEntryModel.findOne({ ...scope, idempotencyKey }).session(session as ClientSession).lean(),
};

export const ReceivableLedgerService = createReceivableLedgerService(mongooseRepository, publishReceivableSettled);
