import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { UserActivityEventModel } from "./user-activity-event.model";

test("user activity schema is append-only and expires events at expiresAt", () => {
  const schema = mongoose.model("UserActivityEvent").schema;
  const indexes = schema.indexes();

  assert.equal(indexes.some(([keys]) => keys.userId === 1 && keys.occurredAt === -1), true);
  assert.equal(indexes.some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0), true);
  assert.equal(schema.path("eventId")?.options.unique, true);
  for (const method of ["updateOne", "findOneAndUpdate", "replaceOne", "deleteOne"]) {
    assert.equal(method in UserActivityEventModel, false, method);
  }
});
