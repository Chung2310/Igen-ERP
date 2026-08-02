import assert from "node:assert/strict";
import test from "node:test";
import { CompanyModel } from "../model/company.model";
import { UserModel } from "../model/user.model";
import { ModuleSettings } from "../modules/student-management/models/module-settings.model";
import { authService } from "./auth.service";

test("login allows a legacy company without lifecycleStatus", async () => {
  const originalFindUser = UserModel.findOne;
  const originalFindCompany = CompanyModel.findOne;

  process.env.JWT_ACCESS_SECRET ||= "test-access-secret-at-least-32-characters";
  process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-at-least-32-characters";

  UserModel.findOne = (() => Promise.resolve({
    _id: "legacy-user-id",
    email: "legacy@example.com",
    role: "user",
    companyCode: "LEGACY",
  })) as typeof UserModel.findOne;

  CompanyModel.findOne = (() => ({
    select: () => ({
      lean: () => Promise.resolve({}),
    }),
  })) as unknown as typeof CompanyModel.findOne;

  try {
    const result = await authService.login("legacy@example.com");
    assert.equal(result.kind, "authenticated");
  } finally {
    UserModel.findOne = originalFindUser;
    CompanyModel.findOne = originalFindCompany;
  }
});

test("register-company persists labor business type and filters stale student modules", async () => {
  const originalCompanyFindOne = CompanyModel.findOne;
  const originalCompanySave = CompanyModel.prototype.save;
  const originalUserFindOne = UserModel.findOne;
  const originalUserSave = UserModel.prototype.save;
  let savedCompany: any;

  (CompanyModel as any).findOne = async () => null;
  (CompanyModel.prototype as any).save = async function () {
    savedCompany = this;
    return this;
  };
  (UserModel as any).findOne = async () => null;
  (UserModel.prototype as any).save = async function () { return this; };

  try {
    await authService.registerCompanyAndAdmin({
      companyName: "Labor Co",
      companyCode: "labor",
      ownerName: "Owner",
      ownerEmail: "owner@labor.test",
      ownerPassword: "password",
      businessType: "labor",
      enabledModules: ["student"],
    });
    assert.equal(savedCompany.businessType, "labor");
    assert.deepEqual(savedCompany.enabledModules, ["worker"]);
  } finally {
    CompanyModel.findOne = originalCompanyFindOne;
    CompanyModel.prototype.save = originalCompanySave;
    UserModel.findOne = originalUserFindOne;
    UserModel.prototype.save = originalUserSave;
  }
});

test("update-company applies a legacy worker preset when filtering modules", async () => {
  const originalCompanyFindById = CompanyModel.findById;
  const originalSettingsFindOne = ModuleSettings.findOne;
  const company: any = {
    code: "LEGACY",
    name: "Legacy Labor Co",
    enabledModules: ["student"],
    save: async function () { return this; },
  };

  (CompanyModel as any).findById = async () => company;
  (ModuleSettings as any).findOne = () => ({
    select: () => ({ lean: async () => ({ entityPreset: "worker" }) }),
  });

  try {
    const updated = await authService.updateCompany("legacy-company-id", { enabledModules: ["student"] });
    assert.equal(updated.businessType, "labor");
    assert.deepEqual(updated.enabledModules, ["worker"]);
  } finally {
    CompanyModel.findById = originalCompanyFindById;
    ModuleSettings.findOne = originalSettingsFindOne;
  }
});
