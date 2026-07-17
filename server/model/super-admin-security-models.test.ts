
import assert from "node:assert/strict";
import test from "node:test";
import mongoose, { Schema, Types } from "mongoose";
import { AdminActionModel } from "./admin-action.model";
import { AuditEventModel, buildAuditEventForInsert } from "./audit-event.model";
import { SuperAdminChallengeModel } from "./super-admin-challenge.model";
import { SuperAdminSessionModel } from "./super-admin-session.model";
import { UserModel } from "./user.model";

const auditSchema = mongoose.model("AuditEvent").schema;
const hasIndex = (indexes: any[], keys: object, options: object) => indexes.some(([actual, opts]) => JSON.stringify(actual) === JSON.stringify(keys) && Object.entries(options).every(([key, value]) => opts[key] === value));

test("identifiers and actor idempotency are unique", () => {
  assert.equal(hasIndex(SuperAdminChallengeModel.schema.indexes(), { challengeId: 1 }, { unique: true }), true);
  assert.equal(hasIndex(SuperAdminSessionModel.schema.indexes(), { sessionId: 1 }, { unique: true }), true);
  assert.equal(hasIndex(AdminActionModel.schema.indexes(), { actionId: 1 }, { unique: true }), true);
  assert.equal(hasIndex(auditSchema.indexes(), { eventId: 1 }, { unique: true }), true);
  assert.equal(hasIndex(AdminActionModel.schema.indexes(), { actorId: 1, idempotencyKey: 1 }, { unique: true }), true);
  assert.equal(
    hasIndex(UserModel.schema.indexes(), { role: 1 }, { unique: true, name: "unique_superadmin_role" }),
    true,
  );
});

test("only challenge and session use TTL", () => {
  assert.equal(hasIndex(SuperAdminChallengeModel.schema.indexes(), { expiresAt: 1 }, { expireAfterSeconds: 0 }), true);
  assert.equal(hasIndex(SuperAdminSessionModel.schema.indexes(), { expiresAt: 1 }, { expireAfterSeconds: 0 }), true);
  assert.equal(AdminActionModel.schema.indexes().some(([, o]) => "expireAfterSeconds" in o), false);
  assert.equal(auditSchema.indexes().some(([, o]) => "expireAfterSeconds" in o), false);
  assert.equal(hasIndex(SuperAdminSessionModel.schema.indexes(), { revokedAt: 1, expiresAt: 1 }, {}), true);
});

test("required fields, enums, and ObjectId types are enforced", () => {
  for (const [schema, paths] of [[SuperAdminChallengeModel.schema, ["challengeId", "userId", "purpose", "passwordVerifiedAt", "expiresAt", "deviceId"]], [SuperAdminSessionModel.schema, ["sessionId", "userId", "expiresAt", "deviceId"]], [AdminActionModel.schema, ["actionId", "actorId", "idempotencyKey", "actionType", "requestHash", "status"]], [auditSchema, ["eventId", "actionType", "riskClass", "result", "actorSuperAdminId", "environment", "correlationId", "occurredAt"]]] as any) paths.forEach((p: string) => assert.equal(schema.path(p)?.options.required, true, p));
  for (const [schema, path] of [[SuperAdminChallengeModel.schema, "userId"], [SuperAdminSessionModel.schema, "userId"], [AdminActionModel.schema, "actorId"], [auditSchema, "actorSuperAdminId"]] as any) assert.equal(schema.path(path) instanceof Schema.Types.ObjectId, true);
  assert.deepEqual(AdminActionModel.schema.path("status")?.options.enum, ["reserved", "running", "succeeded", "partial", "failed"]);
  assert.deepEqual(auditSchema.path("riskClass")?.options.enum, ["read_only", "standard", "sensitive", "dangerous"]);
});

test("audit facade is append/read only", () => {
  for (const method of ["create", "insertMany", "find", "findOne", "findById"]) assert.equal(typeof (AuditEventModel as any)[method], "function");
  for (const method of ["updateOne", "findOneAndUpdate", "replaceOne", "deleteOne", "findOneAndDelete"]) assert.equal(method in AuditEventModel, false, method);
});

test("audit builder recursively redacts persisted payloads", () => {
  const built = buildAuditEventForInsert({ eventId: "e", actionType: "read", riskClass: "read_only", result: "success", actorSuperAdminId: new Types.ObjectId(), environment: "staging", correlationId: "c", before: { password: "secret", nested: [{ accessToken: "token" }] }, after: { safe: true }, metadata: { privateKey: "pem" } });
  assert.deepEqual(built.before, { password: "[REDACTED]", nested: [{ accessToken: "[REDACTED]" }] });
  assert.deepEqual(built.after, { safe: true });
  assert.deepEqual(built.metadata, { privateKey: "[REDACTED]" });
});

test("audit paths are immutable and action timestamps are managed", () => {
  for (const p of Object.keys(auditSchema.paths).filter((p) => !["_id", "__v"].includes(p))) assert.equal(auditSchema.path(p)?.options.immutable, true, p);
  assert.equal(AdminActionModel.schema.get("timestamps"), true);
});

test("audit events expose immutable operational references and timeline indexes", () => {
  for (const path of ["entityType", "entityId", "projectId", "taskId", "workflowId", "tenantId"]) {
    assert.ok(auditSchema.path(path), path);
    assert.equal(auditSchema.path(path)?.options.immutable, true, path);
  }

  assert.equal(
    hasIndex(auditSchema.indexes(), { companyCode: 1, occurredAt: -1 }, {}),
    true,
  );
});

test("toJSON and toObject omit privileged secrets", () => {
  assert.equal(UserModel.schema.path("superAdminSecurity.totpSecretEncrypted")?.options.select, false);
  assert.equal(UserModel.schema.path("superAdminSecurity.recoveryCodeHashes")?.options.select, false);
  const user = new UserModel({ email: "root@example.com", displayName: "Root", superAdminSecurity: { totpEnabled: true, totpSecretEncrypted: "encrypted", recoveryCodeHashes: ["hashed"], failedTotpAttempts: 0 } });
  for (const value of [user.toJSON(), user.toObject()] as any[]) {
    assert.equal(value.superAdminSecurity.totpSecretEncrypted, undefined);
    assert.equal(value.superAdminSecurity.recoveryCodeHashes, undefined);
  }
});

test("audit events expose immutable operational trace references", () => {
  for (const field of ["entityType", "entityId", "projectId", "taskId", "workflowId", "tenantId"]) {
    assert.equal(auditSchema.path(field)?.options.immutable, true, field);
  }
  assert.equal(auditSchema.indexes().some(([keys]: any) => keys.companyCode === 1 && keys.occurredAt === -1), true);
});
