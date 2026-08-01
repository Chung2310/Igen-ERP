import assert from "node:assert/strict";
import { afterEach, it, vi } from "vitest";
import { Notification } from "../models/notification.model";
import { Student } from "../models/student.model";
import { NotificationService } from "./notification.service";

const ownerScope = ["shared-owner"];
const branchId = "branch-a";

afterEach(() => vi.restoreAllMocks());

it("scopes notification list and delete queries to the selected branch", async () => {
  const countDocuments = vi.spyOn(Notification as any, "countDocuments").mockResolvedValue(0);
  const find = vi.spyOn(Notification as any, "find").mockImplementation(() => ({
    sort: () => ({ skip: () => ({ limit: async () => [] }) }),
  }));

  await NotificationService.getNotifications(ownerScope, {}, branchId);
  assert.deepEqual(countDocuments.mock.calls[0]?.[0], { ownerId: { $in: ownerScope }, branchId });
  assert.deepEqual(find.mock.calls[0]?.[0], { ownerId: { $in: ownerScope }, branchId });

  const findOneAndDelete = vi.spyOn(Notification as any, "findOneAndDelete").mockResolvedValue(null);
  await NotificationService.deleteNotification(ownerScope, "notification-a", branchId);
  assert.deepEqual(findOneAndDelete.mock.calls[0]?.[0], {
    _id: "notification-a",
    ownerId: { $in: ownerScope },
    branchId,
  });
});

it("stamps notification creates and scopes installment students to the selected branch", async () => {
  const save = vi.spyOn(Notification.prototype as any, "save").mockImplementation(async function () {
    return this;
  });
  const findOne = vi.spyOn(Student as any, "findOne").mockResolvedValue(null);

  await NotificationService.createNotification("shared-owner", branchId, {
    title: "Reminder",
    content: "Payment due",
    recipients: "All students",
    recipientCount: 1,
    channels: ["Email"],
    status: "Đã gửi",
    installmentPlan: { installmentNo: 1, percent: 50, label: "Đợt 1" },
    studentIds: ["student-a"],
  });

  assert.equal((save.mock.instances[0] as any).branchId, branchId);
  assert.deepEqual(findOne.mock.calls[0]?.[0], { _id: "student-a", ownerId: "shared-owner", branchId });
});
