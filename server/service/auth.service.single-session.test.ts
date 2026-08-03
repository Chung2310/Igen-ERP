import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { authService } from "./auth.service";
import { getJwtRefreshSecret } from "../config/env";

function makeUser(activeSessionId = "") {
  return {
    _id: "user-1",
    email: "user@example.com",
    role: "user",
    companyCode: "ACME",
    activeSessionId,
    activeSessionIssuedAt: undefined as Date | undefined,
    activeSessionLastSeenAt: undefined as Date | undefined,
    activeSessionUserAgent: "",
    activeSessionIp: "",
    save: vi.fn(async function (this: any) { return this; }),
  } as any;
}

describe("regular user single active session", () => {
  let user: any;
  const originalUserFindOne = UserModel.findOne;
  const originalUserFindById = UserModel.findById;
  const originalCompanyFindOne = CompanyModel.findOne;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET ||= "test-access-secret-at-least-32-characters";
    process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-at-least-32-characters";
    user = makeUser();
    (UserModel as any).findOne = async () => user;
    (UserModel as any).findById = async () => user;
    (CompanyModel as any).findOne = () => ({ select: () => ({ lean: async () => ({ lifecycleStatus: "active" }) }) });
  });

  afterEach(() => {
    UserModel.findOne = originalUserFindOne;
    UserModel.findById = originalUserFindById;
    CompanyModel.findOne = originalCompanyFindOne;
    vi.restoreAllMocks();
  });

  it("replaces the active regular session on the second login", async () => {
    const first = await authService.login("user@example.com");
    const firstRefresh = jwt.verify(first.refreshToken, getJwtRefreshSecret()) as any;
    assert.equal(firstRefresh.sid, user.activeSessionId);

    const firstSessionId = user.activeSessionId;
    const second = await authService.login("user@example.com");
    const secondRefresh = jwt.verify(second.refreshToken, getJwtRefreshSecret()) as any;

    assert.ok(firstSessionId);
    assert.notEqual(secondRefresh.sid, firstSessionId);
    assert.equal(secondRefresh.sid, user.activeSessionId);
  });

  it("rejects refresh tokens from a displaced regular session", async () => {
    const first = await authService.login("user@example.com");
    const firstRefreshToken = first.refreshToken;
    await authService.login("user@example.com");

    await assert.rejects(() => authService.refresh(firstRefreshToken), /thiết bị khác|SESSION_REPLACED|không hợp lệ/i);
  });
});

