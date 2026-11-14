import mongoose from "mongoose";
import express, { type ErrorRequestHandler } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateCustomerPhoneIndex } from "../../scripts/migrate-customer-phone-index";
import { CustomerModel } from "./models/customer.model";
import { CustomerService } from "./customer.service";
import { suiteDataRouter } from "../marketing-suite/shared/data.router";
import { CRMTicketModel } from "../marketing-suite/message/model/crm-ticket.model";
import { CustomerModuleLinkModel } from "./models/customer-module-link.model";
import { customerModuleLinksRouter } from "./customer-module-links.router";
import { CompanyModel } from "../../model/company.model";
import { BranchModel } from "../../model/branch.model";
import { healthcareDb, records } from "../healthcare/store";
import { Student } from "../student-management/models/student.model";

describe("shared customer IDs", () => {
  let mongo: MongoMemoryReplSet;
  let server: Server;
  let origin: string;
  const branchId = new mongoose.Types.ObjectId();
  const otherBranchId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await Promise.all([CustomerModel.init(), CustomerModuleLinkModel.init(), CRMTicketModel.init()]);
    await CompanyModel.collection.insertOne({ code: "LEAD-QA", enabledModules: ["customer", "student", "healthcare"] });
    await BranchModel.collection.insertMany([{ _id: branchId, companyCode: "LEAD-QA", code: "MAIN", isActive: true }, { _id: otherBranchId, companyCode: "LEAD-QA", code: "OTHER", isActive: true }]);
    const app = express();
    app.use(express.json(), (req, _res, next) => {
      Object.assign(req, { user: { id: "admin", name: "Admin", role: "superadmin", companyCode: "LEAD-QA" } });
      next();
    });
    app.use("/customers", customerModuleLinksRouter);
    app.use(suiteDataRouter);
    app.use(((error, _req, res, _next) => { res.status(500).json({ message: error.message }); }) as ErrorRequestHandler);
    server = await new Promise<Server>(resolve => {
      const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);

  afterAll(async () => {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()));
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it("preserves the old index on preview and supports two customers sharing a phone after migration", async () => {
    await CustomerModel.collection.createIndex({ companyCode: 1, normalizedPhone: 1 }, { unique: true, name: "legacy_phone" });
    const scope = { companyCode: "SHARED" };
    const actor = { id: "admin", name: "Admin" };
    const phone = "0901234567";
    const an = await CustomerService.create(scope, { name: "An", phone }, actor);
    expect(await migrateCustomerPhoneIndex(false)).toMatchObject({ oldUniqueIndexes: ["legacy_phone"], changed: false });
    await expect(CustomerService.create(scope, { name: "Bình", phone, allowSharedPhone: true }, actor))
      .rejects.toMatchObject({ code: "CUSTOMER_PHONE_EXISTS" });
    expect(await migrateCustomerPhoneIndex(true)).toMatchObject({ changed: true });
    expect(await migrateCustomerPhoneIndex(true)).toMatchObject({ changed: false });
    const binh = await CustomerService.create(scope, { name: "Bình", phone, allowSharedPhone: true }, actor);
    expect(String(binh._id)).not.toBe(String(an._id));
    expect((await CustomerService.list(scope, { q: "+84 901 234 567" })).items).toHaveLength(2);
    await expect(CustomerService.update(scope, String(an._id), { name: "An mới" }, an.version)).resolves.toMatchObject({ name: "An mới" });
    const concurrent = await Promise.allSettled([
      CustomerService.create(scope, { name: "Cường", phone: "0981111111" }, actor),
      CustomerService.create(scope, { name: "Dũng", phone: "0981111111" }, actor),
    ]);
    expect(concurrent.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(concurrent.find(result => result.status === "rejected")).toMatchObject({ reason: { code: "CUSTOMER_PHONE_EXISTS" } });
  });

  it("does not create a second customer when a Lead save is retried concurrently", async () => {
    const companyCode = "LEAD-QA";
    const lead = await CRMTicketModel.create({ companyCode, customerName: "Lan", phone: "0912345999" });
    const request = (data: object) => fetch(`${origin}/omni-inbox/leads/${lead._id}/customer`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    const responses = await Promise.all([request({ create: true }), request({ create: true })]);
    const results = await Promise.all(responses.map(response => response.json()));
    expect(responses.map(response => response.status), JSON.stringify(results)).toEqual([200, 200]);
    expect(results[0].data).toEqual(results[1].data);
    expect(await CustomerModel.countDocuments({ companyCode })).toBe(1);
    const foreign = await CustomerService.create({ companyCode: "OTHER" }, { name: "Bình", phone: "0912345998" }, { id: "qa", name: "QA" });
    const unlinked = await CRMTicketModel.create({ companyCode, customerName: "Khách khác" });
    const mismatch = await fetch(`${origin}/omni-inbox/leads/${unlinked._id}/customer`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: String(foreign._id) }),
    });
    expect(mismatch.status).toBe(404);
  });

  it("links existing education and healthcare records without changing their source records", async () => {
    const companyCode = "LEAD-QA";
    const branch = String(branchId);
    const learnerId = new mongoose.Types.ObjectId();
    const patientId = "550e8400-e29b-41d4-a716-446655440000";
    await Student.collection.insertOne({ _id: learnerId, branchId: branch, ownerId: branch, fullName: "Lan", status: ["Đang học"], paidAmount: 1000 });
    const patients = records(await healthcareDb(), "patients");
    await patients.insertOne({ _id: patientId, code: "BN-QA", name: "Lan", companyCode, branchId: branch } as never);
    const customer = await CustomerService.create({ companyCode }, { name: "Lan", phone: "0999111222" }, { id: "qa", name: "QA" });
    const other = await CustomerService.create({ companyCode }, { name: "Hà", phone: "0999111223" }, { id: "qa", name: "QA" });
    const url = (id: unknown, suffix = "", branchCode = branch) =>
      `${origin}/customers/${id}/module-links${suffix}?companyCode=${companyCode}&branchId=${branchCode}`;
    const learnerPath = `/students/${learnerId}`;
    expect((await fetch(url(customer._id, learnerPath), { method: "PUT" })).status).toBe(200);
    expect((await fetch(url(customer._id, `/healthcare/${patientId}`), { method: "PUT" })).status).toBe(200);
    expect((await fetch(url(other._id, learnerPath), { method: "PUT" })).status).toBe(409);
    expect((await (await fetch(url(customer._id))).json()).data.links).toMatchObject([
      { id: String(learnerId), module: "students", paidAmount: 1000, canUnlink: true },
      { id: patientId, module: "healthcare", code: "BN-QA", canUnlink: true },
    ]);
    expect((await (await fetch(url(customer._id, "", String(otherBranchId)))).json()).data.links).toEqual([]);
    const linkedModulesUrl = (branchCode: string) => `${origin}/customers/linked-modules?companyCode=${companyCode}&branchId=${branchCode}&customerIds=${customer._id},${other._id}`;
    expect((await (await fetch(linkedModulesUrl(branch))).json()).data).toEqual({
      [String(customer._id)]: ["students", "healthcare"], [String(other._id)]: [],
    });
    expect((await (await fetch(linkedModulesUrl(String(otherBranchId)))).json()).data).toEqual({
      [String(customer._id)]: [], [String(other._id)]: [],
    });
    expect((await fetch(url(customer._id, learnerPath), { method: "DELETE" })).status).toBe(200);
    expect(await Student.exists({ _id: learnerId })).toBeTruthy();
    expect((await (await fetch(url(customer._id))).json()).data.links).toHaveLength(1);
  });

  it("keeps one customer per source record and allows the customer to have multiple sources", async () => {
    const key = { companyCode: "SHARED", module: "students", sourceId: "SOURCE" } as const;
    await CustomerModuleLinkModel.create({ ...key, customerId: "AN", linkedBy: "admin" });
    await expect(CustomerModuleLinkModel.create({ ...key, customerId: "BINH", linkedBy: "admin" })).rejects.toMatchObject({ code: 11000 });
    await CustomerModuleLinkModel.create({ ...key, module: "healthcare", customerId: "AN", linkedBy: "admin" });
    expect(await CustomerModuleLinkModel.countDocuments({ companyCode: "SHARED", customerId: "AN" })).toBe(2);
  });

  it("returns both customers sharing a number and only links the confirmed customer", async () => {
    const companyCode = "LEAD-QA";
    const branch = String(branchId);
    const learnerId = new mongoose.Types.ObjectId();
    const phone = "0987665432";
    const actor = { id: "qa", name: "QA" };
    await Student.collection.insertOne({ _id: learnerId, branchId: branch, ownerId: branch, fullName: "Phạm Minh An", phone: "+84 987 665 432", birthday: "18/05/2003" });
    const first = await CustomerService.create({ companyCode }, { name: "Phạm Minh An", phone, dateOfBirth: "2003-05-18" }, actor);
    const second = await CustomerService.create({ companyCode }, { name: "Phạm Duy An", phone, allowSharedPhone: true }, actor);
    const url = (suffix = "", branchCode = branch) => `${origin}/customers/source-records/students${suffix}?companyCode=${companyCode}&branchId=${branchCode}`;
    const path = `/${learnerId}`;
    const post = (data: object) => fetch(url(`${path}/customer`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    expect((await (await fetch(url() + "&q=Phạm Minh An")).json()).data).toMatchObject([{ id: String(learnerId), dateOfBirth: "18/05/2003" }]);
    expect((await (await fetch(url() + `&q=${phone}`)).json()).data).toMatchObject([{ id: String(learnerId) }]);
    const candidateResponse = await fetch(url(`${path}/customers`));
    expect(candidateResponse.status).toBe(200);
    expect((await candidateResponse.json()).data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ customerId: String(first._id), dateOfBirth: "2003-05-18", samePhone: true }),
      expect.objectContaining({ customerId: String(second._id), samePhone: true }),
    ]));
    expect((await fetch(url(`${path}/customers`, String(otherBranchId)))).status).toBe(404);
    expect((await post({ create: true, phone })).status).toBe(409);
    expect(await CustomerModuleLinkModel.countDocuments({ companyCode, sourceId: String(learnerId) })).toBe(0);
    expect((await post({ customerId: String(first._id) })).status).toBe(200);
    expect((await post({ customerId: String(second._id) })).status).toBe(409);
    expect((await (await fetch(url() + "&q=Phạm Minh An")).json()).data).toEqual([]);
  });

  it("creates one customer and one link when importing the same patient twice", async () => {
    const companyCode = "LEAD-QA";
    const patientId = "550e8400-e29b-41d4-a716-446655440010";
    const phone = "0976433122";
    await records(await healthcareDb(), "patients").insertOne({ _id: patientId, code: "BN-OLD", name: "Lê Hải Vy", phone, dateOfBirth: "04/02/2009", companyCode, branchId: String(branchId) } as never);
    const url = `${origin}/customers/source-records/healthcare/${patientId}/customer?companyCode=${companyCode}&branchId=${branchId}`;
    const request = () => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ create: true, phone }) });
    const responses = await Promise.all([request(), request()]);
    const results = await Promise.all(responses.map(response => response.json()));
    expect(responses.map(response => response.status), JSON.stringify(results)).toEqual([200, 200]);
    expect(results[0].data).toMatchObject({ name: "Lê Hải Vy", dateOfBirth: "2009-02-04T00:00:00.000Z", source: "import" });
    expect(results[0].data._id).toBe(results[1].data._id);
    expect(await CustomerModel.countDocuments({ companyCode, phone })).toBe(1);
    expect(await CustomerModuleLinkModel.countDocuments({ companyCode, sourceId: patientId })).toBe(1);
  });

  it("transfers only confirmed ready sources and keeps numbers shared inside the batch for review", async () => {
    const companyCode = "LEAD-QA";
    const branch = String(branchId);
    const patients = records(await healthcareDb(), "patients");
    const ids = Array.from({ length: 5 }, (_, index) => `550e8400-e29b-41d4-a716-44665544002${index}`);
    const phones = ["0911112323", "0922223434", "+84 922 223 434", "0933334545", ""];
    await patients.insertMany(ids.map((id, index) => ({ _id: id, code: `BN-BATCH-${index}`, name: `Khách lô ${index}`, phone: phones[index], companyCode, branchId: branch })) as never);
    const refs = ids.map(sourceId => ({ sourceId, module: "healthcare" }));
    const post = async (path: string, approved?: typeof refs) => {
      const response = await fetch(`${origin}/customers/source-records/batch/${path}?companyCode=${companyCode}&branchId=${branch}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: refs, approved }),
      });
      const body = await response.json();
      expect(response.status, JSON.stringify(body)).toBe(200);
      return body.data.map((row: { status: string }) => row.status);
    };
    expect(await post("preview")).toEqual(["ready", "shared-batch-phone", "shared-batch-phone", "ready", "missing-phone"]);
    expect(await CustomerModuleLinkModel.countDocuments({ sourceId: { $in: ids } })).toBe(0);
    await CustomerService.create({ companyCode }, { name: "Khách vừa thêm", phone: phones[3] }, { id: "qa", name: "QA" });
    expect(await post("transfer", refs)).toEqual(["transferred", "shared-batch-phone", "shared-batch-phone", "shared-customer-phone", "missing-phone"]);
    expect(await post("transfer", refs)).toEqual(["linked", "shared-batch-phone", "shared-batch-phone", "shared-customer-phone", "missing-phone"]);
    expect(await CustomerModuleLinkModel.countDocuments({ sourceId: { $in: ids } })).toBe(1);
    const queue = await fetch(`${origin}/customers/source-records/healthcare/queue?companyCode=${companyCode}&branchId=${branch}&q=BN-BATCH`);
    const queueIds = (await queue.json()).data.items.map((item: { id: string }) => item.id);
    expect(queueIds).toHaveLength(4);
    expect(queueIds).not.toContain(ids[0]);
  });

  it("hides each module action independently and can restore it", async () => {
    const url = (module: string) => `${origin}/customers/source-transfer-settings/${module}?companyCode=LEAD-QA&branchId=${branchId}`;
    const setting = async (module: string, hidden?: boolean) => {
      const response = await fetch(url(module), hidden === undefined ? undefined : {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hidden }),
      });
      const body = await response.json();
      expect(response.status, JSON.stringify(body)).toBe(200);
      return body.data.hidden;
    };
    await setting("students", true);
    expect(await setting("students")).toBe(true);
    expect(await setting("healthcare")).toBe(false);
    await setting("students", false);
    expect(await setting("students")).toBe(false);
  });
});
