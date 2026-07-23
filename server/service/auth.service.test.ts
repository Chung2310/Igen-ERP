import assert from "node:assert/strict";
import test from "node:test";
import { CompanyModel } from "../model/company.model";
import { UserModel } from "../model/user.model";
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
