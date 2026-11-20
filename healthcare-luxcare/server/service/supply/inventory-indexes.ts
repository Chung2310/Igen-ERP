import { SupplyOperationModel } from "../../model/supply-operation.model";
import { supplyInventoryModels } from "../../model/supply-inventory.model";
import { SupplyError } from "./errors";

export function isMatchingIndexKeys(indexKey: Record<string, any>, schemaKeys: Record<string, any>): boolean {
  if (!indexKey || !schemaKeys) return false;
  const indexFields = Object.keys(indexKey);
  const schemaFields = Object.keys(schemaKeys);
  if (indexFields.length !== schemaFields.length) return false;
  return schemaFields.every(
    (field, idx) => indexFields[idx] === field && Number(indexKey[field]) === Number(schemaKeys[field]),
  );
}

/** Explicit provisioning; never drops or rebuilds an existing index. */
export async function inspectInventoryIndexes(apply = false) {
  const results: Array<{ collection: string; keys: Record<string, any>; status: string }> = [];
  for (const model of [...supplyInventoryModels, SupplyOperationModel]) {
    let existing: any[] = [];
    try {
      existing = await model.collection.indexes();
    } catch (error) {
      if ((error as any).code !== 26) throw error;
    }
    for (const [keys, options] of model.schema.indexes()) {
      const match = existing.find((index) => isMatchingIndexKeys(index.key, keys as Record<string, any>));
      if (match && (Boolean(match.unique) !== Boolean(options.unique) || match.partialFilterExpression || match.sparse))
        throw new SupplyError("INDEX_CONFLICT", `Index không tương thích tại ${model.collection.name}.`, 409);
      if (match) {
        results.push({ collection: model.collection.name, keys, status: "ready" });
        continue;
      }
      if (options.unique) {
        const duplicates = await model.collection
          .aggregate([
            { $group: { _id: Object.fromEntries(Object.keys(keys).map((k) => [k, "$" + k])), count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
            { $limit: 1 },
          ])
          .toArray();
        if (duplicates.length) {
          if (apply && model.collection.name === "supplylots") {
            const dupGroups = await model.collection
              .aggregate([
                {
                  $group: {
                    _id: Object.fromEntries(Object.keys(keys).map((k) => [k, "$" + k])),
                    ids: { $push: "$_id" },
                    count: { $sum: 1 },
                  },
                },
                { $match: { count: { $gt: 1 } } },
              ])
              .toArray();
            for (const group of dupGroups) {
              const [, ...toRemove] = group.ids;
              if (toRemove.length) {
                await model.collection.deleteMany({ _id: { $in: toRemove } });
              }
            }
          } else {
            throw new SupplyError(
              "INDEX_DUPLICATES",
              `Có khóa trùng tại ${model.collection.name}; cần đối chiếu trước khi tạo index.`,
              409,
            );
          }
        }
      }
      if (apply)
        await model.collection.createIndex(keys as Parameters<typeof model.collection.createIndex>[0], {
          unique: Boolean(options.unique),
        });
      results.push({ collection: model.collection.name, keys, status: apply ? "created" : "missing" });
    }
  }
  return results;
}
export async function assertInventoryIndexes() {
  const indexes = await inspectInventoryIndexes(true);
  if (indexes.some((index) => index.status !== "ready" && index.status !== "created"))
    throw new SupplyError(
      "INVENTORY_INDEXES_MISSING",
      "Cần chuẩn bị đầy đủ index kho nhiều lô trước khi ghi dữ liệu.",
      503,
    );
}
