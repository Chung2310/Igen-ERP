import mongoose from "mongoose";
import type { FinanceScope } from "../contracts";
import { FixedAssetModel } from "../models/fixed-asset.model";
import { AssetDepreciationModel } from "../models/asset-depreciation.model";
import { ConflictError, NotFoundError } from "../../../errors/app-error";
/** Financial balances and posting flags must commit together, in period order. */
export async function postDepreciationAtomic(scope: FinanceScope, period: string, actor: {
    id?: string;
    uid?: string;
}) {
    const filter = { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), period };
    const session = await mongoose.startSession();
    try {
        let result: any;
        await session.withTransaction(async () => {
            const all = await AssetDepreciationModel.find(filter).session(session).lean();
            if (!all.length)
                throw new NotFoundError("ASSET_PERIOD_NOT_SCHEDULED", "Kỳ khấu hao chưa được lập kế hoạch.");
            const pending = all.filter(l => l.status === "planned");
            if (!pending.length)
                throw new ConflictError("ASSET_PERIOD_ALREADY_POSTED", "Kỳ đã được ghi sổ.");
            const postedAt = new Date();
            const lines = [];
            for (const line of pending) {
                const asset = await FixedAssetModel.findOneAndUpdate({ _id: line.assetId, companyCode: scope.companyCode, branchId: line.branchId, status: { $ne: "disposed" }, accumulatedDepreciation: line.accumulatedAfter - line.amount }, { $set: { accumulatedDepreciation: line.accumulatedAfter, netBookValue: line.netBookValueAfter } }, { session, returnDocument: "after" });
                if (!asset)
                    throw new ConflictError("ASSET_PERIOD_ALREADY_POSTED", "Số dư khấu hao không khớp kỳ trước hoặc tài sản đã thanh lý. Hãy ghi sổ theo thứ tự kỳ.");
                lines.push(await AssetDepreciationModel.findOneAndUpdate({ _id: line._id, ...filter, status: "planned" }, { $set: { status: "posted", postedAt, postedBy: String(actor.id || actor.uid || "system") } }, { session, returnDocument: "after" }).lean());
            }
            result = { period, posted: lines.length, lines };
        });
        return result;
    }
    finally {
        await session.endSession();
    }
}
