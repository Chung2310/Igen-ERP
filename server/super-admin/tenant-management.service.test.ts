import assert from "node:assert/strict";
import test from "node:test";
import { TenantManagementService, type TenantRecord, type TenantRepository } from "./tenant-management.service";

function repository(seed: TenantRecord[] = []): TenantRepository {
  const tenants = new Map(seed.map((tenant) => [tenant.code, { ...tenant }]));
  return {
    async create(tenant) { tenants.set(tenant.code, { ...tenant }); return { ...tenant }; },
    async list() { return [...tenants.values()].map((tenant) => ({ ...tenant })); },
    async get(code) { const tenant = tenants.get(code); return tenant ? { ...tenant } : null; },
    async update(code, update) {
      const tenant = tenants.get(code);
      if (!tenant) return null;
      const next = { ...tenant, ...update };
      tenants.set(code, next);
      return { ...next };
    },
  };
}

test("transitions tenants through active, suspended, archived, and scheduled deletion", async () => {
  const service = new TenantManagementService(repository([{ code: "ACME", name: "Acme", ownerEmail: "owner@acme.test", lifecycleStatus: "active", createdAt: new Date("2026-01-01") }]));

  assert.equal((await service.transitionLifecycle("ACME", "suspended")).lifecycleStatus, "suspended");
  assert.equal((await service.transitionLifecycle("ACME", "archived")).lifecycleStatus, "archived");
  assert.equal((await service.scheduleDeletion("ACME", "contract ended", new Date("2026-07-17"))).lifecycleStatus, "scheduled-deletion");
  assert.equal((await service.cancelDeletion("ACME")).lifecycleStatus, "archived");
  assert.equal((await service.transitionLifecycle("ACME", "active")).lifecycleStatus, "active");
});

test("rejects invalid lifecycle transitions and deletion cancellation", async () => {
  const service = new TenantManagementService(repository([{ code: "ACME", name: "Acme", ownerEmail: "owner@acme.test", lifecycleStatus: "active", createdAt: new Date() }]));

  await assert.rejects(() => service.transitionLifecycle("ACME", "scheduled-deletion" as any), /Invalid lifecycle/);
  await assert.rejects(() => service.cancelDeletion("ACME"), /not scheduled/);
  await assert.rejects(() => service.transitionLifecycle("UNKNOWN", "suspended"), /not found/);
});

test("uses allow-listed create and update fields", async () => {
  const service = new TenantManagementService(repository());

  const created = await service.create({ code: " acme ", name: "Acme", ownerEmail: "owner@acme.test", ignored: "nope" } as any);
  const updated = await service.update("ACME", { name: "Acme 2", ownerEmail: "new@acme.test", code: "OTHER", ignored: "nope" } as any);

  assert.equal(created.code, "ACME");
  assert.equal((created as any).ignored, undefined);
  assert.equal(updated.name, "Acme 2");
  assert.equal(updated.code, "ACME");
  assert.equal((updated as any).ignored, undefined);
});

test("only schedules archived tenants when preview and backup evidence are recorded", async () => {
  const service = new TenantManagementService(repository([{ code: "ACME", name: "Acme", ownerEmail: "owner@acme.test", lifecycleStatus: "active", createdAt: new Date() }]));
  await assert.rejects(() => service.scheduleDeletion("ACME", "contract ended", new Date(), { affectedUsers: 1 }, "backup-1"), /archived/);
  await service.transitionLifecycle("ACME", "archived");
  await assert.rejects(() => service.scheduleDeletion("ACME", "contract ended", new Date(), undefined as any, "backup-1"), /impact preview/);
  const scheduled: any = await service.scheduleDeletion("ACME", "contract ended", new Date(), { affectedUsers: 1 }, "backup-1");
  assert.equal(scheduled.deletionJob.status, "queued"); assert.equal(scheduled.deletionJob.backupEvidenceId, "backup-1");
});