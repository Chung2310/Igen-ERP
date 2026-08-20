import type { FinanceBranchScope, FinanceScope } from "../contracts";
import { AssetInventorySessionModel } from "../models/asset-inventory.model";
import { FixedAssetModel } from "../models/fixed-asset.model";
import { ConflictError, NotFoundError } from "../../../errors/app-error";

type Actor = { id?: string; uid?: string; name?: string; displayName?: string };

export interface AssetInventoryRepository {
  listSessions(scope: FinanceScope, status?: string): Promise<any[]>;
  findSession(scope: FinanceScope, id: string): Promise<any | null>;
  findSessionByCode(companyCode: string, sessionCode: string): Promise<any | null>;
  createSession(values: any): Promise<any>;
  recordCount(id: string, barcode: string, update: Record<string, unknown>): Promise<any | null>;
  appendItem(id: string, item: any): Promise<any | null>;
  finalizeSession(id: string, finalizedBy: string, finalizedAt: Date): Promise<any | null>;
  listAssetsForScope(companyCode: string, branchIds: string[]): Promise<any[]>;
}

const identity = (actor: Actor) => String(actor.id || actor.uid || "system");

/** Counts by result plus the items that disagree with the opening snapshot. */
export function summarizeVariance(session: any) {
  const items: any[] = session.items || [];
  const counts = items.reduce((totals: Record<string, number>, item) => ({ ...totals, [item.result]: (totals[item.result] || 0) + 1 }), {});
  return {
    total: items.length,
    counts,
    variances: items.filter((item) => item.result !== "present" && item.result !== "pending"),
  };
}

export function createAssetInventoryService(repository: AssetInventoryRepository) {
  async function loadSession(scope: FinanceScope, id: string) {
    const session = await repository.findSession(scope, id);
    if (!session) throw new NotFoundError("INVENTORY_SESSION_NOT_FOUND", "Không tìm thấy phiên kiểm kê.");
    return session;
  }

  function assertOpen(session: any) {
    if (session.status !== "open") throw new ConflictError("INVENTORY_SESSION_CLOSED", "Phiên kiểm kê đã chốt, không thể ghi nhận thêm.");
  }

  return {
    list: (scope: FinanceScope, query: any = {}) => repository.listSessions(scope, query?.status ? String(query.status) : undefined),

    detail: (scope: FinanceScope, id: string) => loadSession(scope, id),

    variance: async (scope: FinanceScope, id: string) => summarizeVariance(await loadSession(scope, id)),

    /** Freezes the expected asset population into the session so later counts compare against the opening state. */
    open: async (scope: FinanceBranchScope, input: any, actor: Actor) => {
      const duplicate = await repository.findSessionByCode(scope.companyCode, input.sessionCode);
      if (duplicate) throw new ConflictError("INVENTORY_SESSION_CODE_EXISTS", "Mã phiên kiểm kê đã tồn tại.");
      const branchIds = input.scope === "company" ? [] : input.branchIds;
      const assets = await repository.listAssetsForScope(scope.companyCode, branchIds);
      if (!assets.length) throw new ConflictError("INVENTORY_SCOPE_EMPTY", "Phạm vi kiểm kê không có tài sản nào.");
      return repository.createSession({
        companyCode: scope.companyCode,
        sessionCode: input.sessionCode,
        name: input.name,
        scope: input.scope,
        branchIds: input.scope === "company" ? [...new Set(assets.map((asset) => String(asset.branchId)))] : branchIds,
        inventoryDate: input.inventoryDate,
        createdBy: identity(actor),
        openedAt: new Date(),
        status: "open",
        items: assets.map((asset) => ({
          assetId: String(asset._id),
          assetCode: asset.assetCode,
          barcode: asset.barcode,
          name: asset.name,
          expectedBranchId: asset.branchId,
          ...(asset.location ? { expectedLocation: asset.location } : {}),
          ...(asset.custodianId ? { expectedCustodianId: asset.custodianId } : {}),
          ...(asset.custodianName ? { expectedCustodianName: asset.custodianName } : {}),
          result: "pending",
        })),
      });
    },

    /** Records one scan; a barcode outside the opening snapshot is appended as a surplus finding. */
    count: async (scope: FinanceScope, id: string, input: any, actor: Actor) => {
      const session = await loadSession(scope, id);
      assertOpen(session);
      const scanned = { scannedAt: new Date(), scannedBy: identity(actor) };
      const known = (session.items || []).find((item: any) => item.barcode === input.barcode);
      if (!known) {
        return repository.appendItem(id, {
          assetCode: input.barcode, barcode: input.barcode, name: input.barcode,
          expectedBranchId: session.branchIds[0] || "", result: "surplus", ...scanned, ...(input.note ? { note: input.note } : {}),
        });
      }
      return repository.recordCount(id, input.barcode, {
        "items.$[item].result": input.result,
        "items.$[item].scannedAt": scanned.scannedAt,
        "items.$[item].scannedBy": scanned.scannedBy,
        ...(input.note ? { "items.$[item].note": input.note } : {}),
      });
    },

    /** Closes the session, turning every never-scanned item into a missing finding. */
    finalize: async (scope: FinanceScope, id: string, actor: Actor) => {
      const session = await loadSession(scope, id);
      assertOpen(session);
      const finalized = await repository.finalizeSession(id, identity(actor), new Date());
      return { session: finalized, variance: summarizeVariance(finalized) };
    },
  };
}

const scopeFilter = (scope: FinanceScope) => ({ companyCode: scope.companyCode, ...(scope.branchId ? { branchIds: scope.branchId } : {}) });

export const assetInventoryRepository: AssetInventoryRepository = {
  listSessions: (scope, status) => AssetInventorySessionModel.find({ ...scopeFilter(scope), ...(status ? { status } : {}) } as any).sort({ inventoryDate: -1 }).lean(),
  findSession: (scope, id) => AssetInventorySessionModel.findOne({ _id: id, ...scopeFilter(scope) } as any).lean(),
  findSessionByCode: (companyCode, sessionCode) => AssetInventorySessionModel.findOne({ companyCode, sessionCode }).lean(),
  createSession: (values) => AssetInventorySessionModel.create(values).then((document) => document.toObject()),
  recordCount: (id, barcode, update) => AssetInventorySessionModel.findOneAndUpdate(
    { _id: id, status: "open" },
    { $set: update },
    { new: true, arrayFilters: [{ "item.barcode": barcode }] },
  ).lean(),
  appendItem: (id, item) => AssetInventorySessionModel.findOneAndUpdate({ _id: id, status: "open" }, { $push: { items: item } }, { new: true }).lean(),
  finalizeSession: (id, finalizedBy, finalizedAt) => AssetInventorySessionModel.findOneAndUpdate(
    { _id: id, status: "open" },
    { $set: { status: "finalized", finalizedBy, finalizedAt, "items.$[pending].result": "missing" } },
    { new: true, arrayFilters: [{ "pending.result": "pending" }] },
  ).lean(),
  listAssetsForScope: (companyCode, branchIds) => FixedAssetModel.find({
    companyCode, status: { $ne: "disposed" }, ...(branchIds.length ? { branchId: { $in: branchIds } } : {}),
  } as any).sort({ assetCode: 1 }).lean(),
};

export const AssetInventoryService = createAssetInventoryService(assetInventoryRepository);
