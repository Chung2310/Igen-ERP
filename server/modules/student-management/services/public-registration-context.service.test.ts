import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../config/env", () => ({ getJwtAccessSecret: () => "test-public-registration-context-secret" }));

import jwt from "jsonwebtoken";
import { createPublicRegistrationToken, verifyPublicRegistrationToken } from "./public-registration-context.service";

describe("public registration context token", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the company, branch, and form preset inside a signed token", () => {
    const context = {
      teacherId: "teacher-1",
      companyCode: "ACME",
      branchId: "branch-a",
      entityPreset: "worker" as const,
    };

    expect(verifyPublicRegistrationToken(createPublicRegistrationToken(context))).toEqual(context);
  });

  it("rejects tokens whose signed tenant scope was edited", () => {
    const token = createPublicRegistrationToken({ teacherId: "teacher-1", companyCode: "ACME", branchId: "branch-a" });
    const [header, payload, signature] = token.split(".");
    const editedPayload = Buffer.from(JSON.stringify({
      ...JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
      companyCode: "OTHER",
    })).toString("base64url");

    expect(() => verifyPublicRegistrationToken(`${header}.${editedPayload}.${signature}`)).toThrow("Liên kết đăng ký không hợp lệ");
  });

  it("rejects expired registration links", () => {
    const expired = jwt.sign({
      purpose: "public-registration-context",
      teacherId: "teacher-1",
      companyCode: "ACME",
    }, "test-public-registration-context-secret", {
      algorithm: "HS256",
      audience: "igen-erp-public-registration",
      expiresIn: "-1s",
    });

    expect(() => verifyPublicRegistrationToken(expired)).toThrow("Liên kết đăng ký không hợp lệ");
  });
});
