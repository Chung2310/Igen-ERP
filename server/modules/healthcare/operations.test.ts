import { describe, expect, it, vi } from "vitest";
import type { Appointment, RecordInput } from "../../../shared/healthcare";
import { prepareAppointment } from "./operations";

const patientId = "27ee9bae-54ef-43bf-b4ef-d96c53d3fb17";
const input: RecordInput<Appointment> = { patientId, visitId: "", doctorId: "", doctorName: "", roomId: "",
  startsAt: "2026-11-10T01:00:00.000Z", endsAt: "2026-11-10T01:30:00.000Z", status: "completed", note: "Ghi chú cũ" };
const { doctorName: _externalDoctor, ...legacyFields } = input;
const previous: Appointment = { ...legacyFields, _id: "27ee9bae-54ef-43bf-b4ef-d96c53d3fb18", revision: 1,
  createdAt: "2026-11-10T00:00:00.000Z", updatedAt: "2026-11-10T00:00:00.000Z" };
const actor = { companyCode: "TEST", branchId: "507f1f77bcf86cd799439012", actorId: "507f1f77bcf86cd799439011" };
const database = () => ({ collection: vi.fn(() => ({ findOne: vi.fn(async () => ({ _id: patientId })) })) });

describe("legacy healthcare appointments", () => {
  it("allows note updates without treating an absent external-doctor field as a moved booking", async () => {
    await expect(prepareAppointment(database() as any, actor, { ...input, note: "Đã liên hệ lại" }, previous))
      .resolves.toMatchObject({ status: "completed", doctorName: "", note: "Đã liên hệ lại" });
  });

  it("continues to block actual doctor changes on a completed booking", async () => {
    await expect(prepareAppointment(database() as any, actor, { ...input, doctorName: "Bác sĩ mới" }, previous))
      .rejects.toThrow("Chỉ lịch chờ hoặc đã xác nhận");
  });
});
