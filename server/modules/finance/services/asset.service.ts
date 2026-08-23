import type { FinanceBranchScope, FinanceScope } from "../contracts";
import type { IAssetLifecycleEvent } from "../interfaces/asset.interface";
import { AssetDepreciationModel } from "../models/asset-depreciation.model";
import { FixedAssetModel } from "../models/fixed-asset.model";
import { buildStraightLineSchedule } from "./depreciation";
import { ConflictError, NotFoundError, ValidationError } from "../../../errors/app-error";

type Actor = { id?: string; uid?: string; name?: string; displayName?: string };

export interface AssetRepository {
  list(scope: FinanceScope, filter: { status?: string; group?: string; search?: string }): Promise<any[]>;
  findById(scope: FinanceScope, id: string): Promise<any | null>;
  findByCodeOrBarcode(companyCode: string, assetCode: string, barcode: string): Promise<any | null>;
  create(values: any): Promise<any>;
  update(scope: FinanceScope, id: string, update: any): Promise<any | null>;
  listDepreciable(scope: FinanceScope): Promise<any[]>;
  findDepreciation(assetId: string, period: string): Promise<any | null>;
  upsertDepreciation(assetId: string, period: string, values: any): Promise<any>;
  listDepreciations(scope: FinanceScope, period: string): Promise<any[]>;
  markDepreciationPosted(id: string, postedBy: string, postedAt: Date): Promise<any | null>;
}

const identity = (actor: Actor) => String(actor.id || actor.uid || "system");

function lifecycleEvent(type: IAssetLifecycleEvent["type"], actor: Actor, note?: string, before?: any, after?: any): IAssetLifecycleEvent {
  return { type, at: new Date(), by: identity(actor), ...(note ? { note } : {}), ...(before ? { before } : {}), ...(after ? { after } : {}) };
}

function scheduleOf(asset: any) {
  return buildStraightLineSchedule({
    originalCost: asset.originalCost,
    salvageValue: asset.salvageValue,
    inServiceDate: new Date(asset.inServiceDate),
    usefulLifeMonths: asset.usefulLifeMonths,
  });
}

/** Straight-line line for one accounting period, or null when the period falls outside the asset's life. */
export function depreciationLineFor(asset: any, period: string) {
  return scheduleOf(asset).find((line) => line.period === period) || null;
}

export function createAssetService(repository: AssetRepository) {
  async function loadAsset(scope: FinanceScope, id: string) {
    const asset = await repository.findById(scope, id);
    if (!asset) throw new NotFoundError("ASSET_NOT_FOUND", "Không tìm thấy tài sản cố định.");
    return asset;
  }

  function assertActive(asset: any) {
    if (asset.status === "disposed") throw new ConflictError("ASSET_ALREADY_DISPOSED", "Tài sản đã thanh lý, không thể thay đổi.");
  }

  return {
    list: (scope: FinanceScope, query: any = {}) => repository.list(scope, {
      status: query.status ? String(query.status) : undefined,
      group: query.group ? String(query.group) : undefined,
      search: query.search ? String(query.search).trim() : undefined,
    }),

    detail: (scope: FinanceScope, id: string) => loadAsset(scope, id),

    schedule: async (scope: FinanceScope, id: string) => scheduleOf(await loadAsset(scope, id)),

    create: async (scope: FinanceBranchScope, input: any, actor: Actor) => {
      const duplicate = await repository.findByCodeOrBarcode(scope.companyCode, input.assetCode, input.barcode);
      if (duplicate) throw new ConflictError("ASSET_CODE_ALREADY_EXISTS", "Mã tài sản hoặc mã vạch đã tồn tại.");
      return repository.create({
        ...input,
        companyCode: scope.companyCode,
        branchId: scope.branchId,
        method: "straight_line",
        status: "in_use",
        accumulatedDepreciation: 0,
        netBookValue: input.originalCost,
        lifecycleEvents: [lifecycleEvent("created", actor, undefined, undefined, { assetCode: input.assetCode, originalCost: input.originalCost })],
      });
    },

    update: async (scope: FinanceScope, id: string, input: { patch: Record<string, unknown>; note?: string }, actor: Actor) => {
      const asset = await loadAsset(scope, id);
      assertActive(asset);
      const before = Object.fromEntries(Object.keys(input.patch).map((field) => [field, asset[field]]));
      return repository.update(scope, id, {
        $set: input.patch,
        $push: { lifecycleEvents: lifecycleEvent("updated", actor, input.note, before, input.patch) },
      });
    },

    transfer: async (scope: FinanceScope, id: string, input: any, actor: Actor) => {
      const asset = await loadAsset(scope, id);
      assertActive(asset);
      const after = { branchId: input.branchId, location: input.location, custodianId: input.custodianId, custodianName: input.custodianName };
      return repository.update(scope, id, {
        $set: Object.fromEntries(Object.entries(after).filter(([, value]) => value !== undefined)),
        $push: {
          lifecycleEvents: lifecycleEvent("transferred", actor, input.reason, {
            branchId: asset.branchId, location: asset.location, custodianId: asset.custodianId, custodianName: asset.custodianName,
          }, after),
        },
      });
    },

    dispose: async (scope: FinanceScope, id: string, input: any, actor: Actor) => {
      const asset = await loadAsset(scope, id);
      assertActive(asset);
      if (new Date(input.disposedAt) < new Date(asset.inServiceDate)) throw new ValidationError("VALIDATION_FAILED", "DISPOSAL_BEFORE_IN_SERVICE");
      return repository.update(scope, id, {
        $set: { status: "disposed", disposedAt: input.disposedAt, disposalAmount: input.disposalAmount, disposalReason: input.reason },
        $push: {
          lifecycleEvents: lifecycleEvent("disposed", actor, input.reason, { status: asset.status, netBookValue: asset.netBookValue }, {
            status: "disposed", disposalAmount: input.disposalAmount,
          }),
        },
      });
    },

    /** Recomputes planned depreciation for every non-disposed asset in scope; posted periods are left untouched. */
    runDepreciation: async (scope: FinanceScope, period: string) => {
      const assets = await repository.listDepreciable(scope);
      const lines = [];
      for (const asset of assets) {
        const line = depreciationLineFor(asset, period);
        if (!line) continue;
        const existing = await repository.findDepreciation(String(asset._id), period);
        if (existing?.status === "posted") continue;
        lines.push(await repository.upsertDepreciation(String(asset._id), period, {
          companyCode: asset.companyCode,
          branchId: asset.branchId,
          assetId: String(asset._id),
          period,
          amount: line.amount,
          accumulatedAfter: line.accumulatedAfter,
          netBookValueAfter: line.netBookValueAfter,
          status: "planned",
        }));
      }
      return { period, planned: lines.length, lines };
    },

    listDepreciations: (scope: FinanceScope, period: string) => repository.listDepreciations(scope, period),

    postDepreciation: async (scope: FinanceScope, period: string, actor: Actor) => {
      const scheduled = await repository.listDepreciations(scope, period);
      if (!scheduled.length) throw new NotFoundError("ASSET_PERIOD_NOT_SCHEDULED", "Kỳ khấu hao chưa được lập kế hoạch.");
      const pending = scheduled.filter((line: any) => line.status !== "posted");
      if (!pending.length) throw new ConflictError("ASSET_PERIOD_ALREADY_POSTED", "Kỳ khấu hao đã được ghi sổ.");
      const postedAt = new Date();
      const lines = [];
      for (const line of pending) {
        await repository.update(scope, String(line.assetId), {
          $set: { accumulatedDepreciation: line.accumulatedAfter, netBookValue: line.netBookValueAfter },
        });
        lines.push(await repository.markDepreciationPosted(String(line._id), identity(actor), postedAt));
      }
      return { period, posted: lines.length, lines };
    },
  };
}

const scopeFilter = (scope: FinanceScope) => ({ companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}) });
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const assetRepository: AssetRepository = {
  list: (scope, filter) => FixedAssetModel.find({
    ...scopeFilter(scope),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.group ? { group: filter.group } : {}),
    ...(filter.search ? { $or: [{ assetCode: filter.search }, { barcode: filter.search }, { name: new RegExp(escapeRegExp(filter.search), "i") }] } : {}),
  } as any).sort({ assetCode: 1 }).lean(),
  findById: (scope, id) => FixedAssetModel.findOne({ _id: id, ...scopeFilter(scope) }).lean(),
  findByCodeOrBarcode: (companyCode, assetCode, barcode) => FixedAssetModel.findOne({ companyCode, $or: [{ assetCode }, { barcode }] }).lean(),
  create: (values) => FixedAssetModel.create(values).then((document) => document.toObject()),
  update: (scope, id, update) => FixedAssetModel.findOneAndUpdate({ _id: id, ...scopeFilter(scope) }, update, { returnDocument: 'after' }).lean(),
  listDepreciable: (scope) => FixedAssetModel.find({ ...scopeFilter(scope), status: { $ne: "disposed" } }).lean(),
  findDepreciation: (assetId, period) => AssetDepreciationModel.findOne({ assetId, period }).lean(),
  upsertDepreciation: (assetId, period, values) => AssetDepreciationModel.findOneAndUpdate({ assetId, period }, { $set: values }, { returnDocument: 'after', upsert: true }).lean(),
  listDepreciations: (scope, period) => AssetDepreciationModel.find({ ...scopeFilter(scope), period }).lean(),
  markDepreciationPosted: (id, postedBy, postedAt) => AssetDepreciationModel.findOneAndUpdate({ _id: id }, { $set: { status: "posted", postedBy, postedAt } }, { returnDocument: 'after' }).lean(),
};

export const AssetService = createAssetService(assetRepository);
