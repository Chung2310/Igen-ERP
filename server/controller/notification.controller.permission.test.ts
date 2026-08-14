import { describe, expect, it, vi, beforeEach } from "vitest";

const dependencies = vi.hoisted(() => ({
  findOne: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock("../model/user.model", () => ({
  UserModel: { findOne: dependencies.findOne },
}));

vi.mock("../service/notification.service", () => ({
  notificationService: { createNotification: dependencies.createNotification },
}));

import { notificationController } from "./notification.controller";

function response() {
  const res: any = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe("notificationController.create permission scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects delivery to a recipient outside the caller company", async () => {
    dependencies.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: "recipient", companyCode: "OTHER" }),
      }),
    });
    const res = response();

    await notificationController.create({
      user: { id: "manager", role: "admin", email: "manager@example.test", companyCode: "ACME" },
      body: { recipientUid: "507f1f77bcf86cd799439011", companyCode: "OTHER", title: "Notice", body: "Body", type: "he-thong" },
    } as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(dependencies.createNotification).not.toHaveBeenCalled();
  });

  it("uses the authenticated caller company instead of a request companyCode", async () => {
    dependencies.findOne.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: "recipient", companyCode: "ACME" }),
      }),
    });
    dependencies.createNotification.mockResolvedValue({ id: "notification" });
    const res = response();

    await notificationController.create({
      user: { id: "manager", role: "admin", email: "manager@example.test", companyCode: "ACME" },
      body: { recipientUid: "507f1f77bcf86cd799439011", companyCode: "OTHER", title: "Notice", body: "Body", type: "he-thong" },
    } as any, res);

    expect(dependencies.createNotification).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "ACME" }));
  });
});
